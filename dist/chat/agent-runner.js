/**
 * Agent Runner — core agent execution loop extracted from REPL index.ts.
 *
 * Used by both the CLI REPL (src/repl/index.ts) and the HTTP API (src/api/routes/chat.ts).
 *
 * References:
 *   Claude Code src/tools/AgentTool/runAgent.ts (35KB)
 *   CodeSquad src/repl/index.ts sendToAgent() (~240 lines)
 */
import { join } from 'path';
import { addMessage } from '../chat/session.js';
import { callLLM, callLLMStream, LlmError } from '../llm/client.js';
import { buildRuntimeConfig } from '../llm/registry.js';
import { callWithFallback } from '../llm/router.js';
import { calculateCost } from '../llm/usage-tracker.js';
import { buildAgentSystemPromptSeparated } from '../prompt/builder.js';
import { getModeSystemPrompt } from '../repl/mode-prompts.js';
import { buildSkillGuidance, buildCapabilitySkillGuidance } from '../repl/skill-registry.js';
import { loadSessionRules } from '../rules/loader.js';
import { findTool, runToolUse, assembleToolPool } from '../tools/registry.js';
import { getSessionCache } from '../tools/file-state.js';
import { microCompact } from '../context/micro-compact.js';
import { incrementTurn, shouldAutoCompact, autoCompact } from '../context/auto-compact.js';
import { parseToolCalls } from '../tools/response-parser.js';
import { toolsToNativeSchemas } from '../tools/schema-converter.js';
import { chatModeToPermissionMode } from '../permissions/mode.js';
import { virtualReadFile } from '../embedded/virtual-fs.js';
import { setAgentLLMBridge, clearAgentLLMBridge } from '../agents/bridge.js';
import { setPendingUserQuestion } from '../hooks/executor.js';
// Team mailbox polling (Feature 3.5 — P4)
import { getUnreadMessages, markRead } from '../teams/mailbox.js';
// ── Core Runner ──
export async function runAgent(config) {
    const { agentName, userInput, session, providerId, modelId, projectRoot, aicoreDir, mode, maxTurns = 20, lang = 'zh', runtimeConfig: configRuntimeConfig, stream = false, onToken, onTurn, onToolUse, onError, } = config;
    // Load agent prompt (VirtualFS: embedded-first, disk-fallback)
    const agentPath = join(aicoreDir, 'agents', `${agentName}.md`);
    let agentPrompt;
    try {
        agentPrompt = virtualReadFile(agentPath, 'utf-8');
    }
    catch {
        throw new Error(`Agent not found: ${agentName}`);
    }
    // Extract agent's thinkingLevel from YAML frontmatter (agents default to 'deep')
    let agentThinkingLevel;
    try {
        const fmMatch = agentPrompt.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (fmMatch) {
            const tlMatch = fmMatch[1].match(/^thinkingLevel\s*:\s*(\w+)\s*$/m);
            if (tlMatch && ['fast', 'think', 'deep'].includes(tlMatch[1])) {
                agentThinkingLevel = tlMatch[1];
            }
        }
    }
    catch { /* fall through */ }
    // Agent's own thinkingLevel takes priority; fall back to config.thinkingMode → LLM default
    const effectiveThinkingMode = agentThinkingLevel || config.thinkingMode;
    // Add user message
    addMessage(session, 'user', userInput);
    // Resolve runtime config: prefer explicit override (web path), fallback to registry (REPL path)
    const rc = configRuntimeConfig ?? await (async () => {
        const built = await buildRuntimeConfig(providerId);
        if (!built)
            throw new Error(`No runtime config for provider: ${providerId}`);
        return built;
    })();
    // Set up Agent LLM bridge (for AgentTool sub-agent calls)
    setAgentLLMBridge({
        callLLM: async (rt, params) => {
            const response = await callLLM(rt || rc, params);
            return { content: response.content, usage: response.usage, model: response.model };
        },
        runtimeConfig: rc,
    });
    // Build tool context
    const abortController = new AbortController();
    const toolContext = {
        session,
        cwd: projectRoot,
        projectRoot,
        aicoreDir,
        abortSignal: abortController.signal,
        permissionMode: chatModeToPermissionMode(mode),
        readFileState: getSessionCache(),
        headless: true,
    };
    let turn = 0;
    let toolCallsMade = 0;
    let consecutiveTruncations = 0;
    let lastCompletionTokens = 0;
    let finalResponse = '';
    let _emptyToolCallCount = 0; // B6 fix: local var instead of mutating config
    // P1 fix: Reset pending user question flag at session start
    setPendingUserQuestion(false, session.id);
    // Helper: route through appropriate LLM path (REPL fallback chain or Web direct call)
    async function fallbackLLMCall(req) {
        if (configRuntimeConfig) {
            // Web path: direct call, no fallback chain
            return await callLLM(rc, req);
        }
        else {
            // REPL path: primary → fallback_chain → Ollama (last resort)
            try {
                const routed = await callWithFallback(req, providerId, modelId, projectRoot);
                return { content: routed.content, model: routed.model, usage: routed.usage, toolCalls: routed.toolCalls };
            }
            catch {
                return await callLLM(rc, req);
            }
        }
    }
    try {
        let compactFailed = false;
        while (turn < maxTurns) {
            turn++;
            incrementTurn(session.id);
            // Phase 6.1: Auto-compact check at the start of each turn
            if (!compactFailed && turn > 1 && session.messages.length >= 10) {
                const check = shouldAutoCompact(session.messages, modelId, session.id);
                if (check.should) {
                    const callLlmFn = async (input) => {
                        const resp = await fallbackLLMCall(input);
                        return resp.content;
                    };
                    onError?.(`Auto-compacting conversation (token usage at ${check.percentUsed.toFixed(0)}%)...`);
                    await autoCompact(session.messages, session, modelId, callLlmFn).catch((err) => {
                        compactFailed = true;
                        const msg = err.message?.includes('TIMEOUT')
                            ? '对话压缩超时，后续将跳过压缩。建议开启新对话。'
                            : `对话压缩失败，后续将跳过压缩。建议开启新对话。`;
                        onError?.(msg);
                    });
                }
            }
            // Build system prompt (P3.5: inject session-level rules)
            // Feature 4 (P4): Use separated static/dynamic parts for prompt caching
            const sessionRules = loadSessionRules(aicoreDir);
            const { staticParts, dynamicParts } = await buildAgentSystemPromptSeparated(agentPrompt, {
                agentName,
                model: modelId,
                cwd: projectRoot,
                projectRoot,
                sessionId: session.id,
                lang,
            }, [
                getModeSystemPrompt(mode),
                buildSkillGuidance(8, lang) || '',
                buildCapabilitySkillGuidance(agentName, lang) || '',
                ...sessionRules,
            ].filter(Boolean));
            // Feature 4 (P4): Build systemContentBlocks with cache_control on last static block
            const systemContentBlocks = [];
            for (let i = 0; i < staticParts.length; i++) {
                const sp = staticParts[i];
                if (!sp)
                    continue;
                systemContentBlocks.push({
                    type: 'text',
                    text: sp,
                    // Put cache_control breakpoint on last static block — blocks before it are cached.
                    // Dynamic parts follow without cache_control (not cached, saving $ on Anthropic).
                    cache_control: (i === staticParts.length - 1) ? { type: 'ephemeral' } : undefined,
                });
            }
            // Dynamic parts go after cache breakpoint (not cached)
            for (const dp of dynamicParts) {
                if (!dp)
                    continue;
                systemContentBlocks.push({ type: 'text', text: dp });
            }
            // Assemble messages (without system — system goes via systemContentBlocks)
            const messages = [];
            // Context files
            if (session.context.injectedContent) {
                const { sanitizeAicorePaths } = await import('../embedded/virtual-fs.js');
                const safeContent = sanitizeAicorePaths(session.context.injectedContent);
                messages.push({
                    role: 'user', content: `[上下文文件]\n${safeContent.slice(0, 50000)}`,
                    timestamp: new Date().toISOString(),
                });
            }
            // History (last 20, skip system) — Feature 5 (P4): apply micro-compact
            const historyMsgs = [];
            for (const msg of session.messages.slice(-20)) {
                if (msg.role === 'system')
                    continue;
                historyMsgs.push({ role: msg.role, content: msg.content, timestamp: msg.timestamp });
            }
            // Compact old tool results to save tokens
            microCompact(historyMsgs);
            for (const hm of historyMsgs) {
                messages.push(hm);
            }
            // Feature 3.5 (P4): Team mailbox polling — check for messages from teammates
            // Mirrors Claude Code: getTeammateMailboxAttachments() injects unread messages as user context
            const teamName = session.teamName || config.teamName;
            if (teamName) {
                const unread = getUnreadMessages(teamName, agentName);
                if (unread.length > 0) {
                    for (const msg of unread) {
                        if (msg.type === 'shutdown_request') {
                            // Respond with approval and abort
                            const { sendMessage } = await import('../teams/mailbox.js');
                            sendMessage(teamName, msg.from, agentName, 'approved', 'shutdown_response', 'Shutdown approved');
                            if (!abortController.signal.aborted) {
                                abortController.abort();
                            }
                            clearAgentLLMBridge();
                            return { finalResponse, turnsUsed: turn, toolCallsMade, error: 'Shutdown requested by teammate' };
                        }
                        // Inject as user context
                        messages.push({
                            role: 'user',
                            content: `[Team Message from ${msg.from}]: ${msg.content}`,
                            timestamp: msg.timestamp,
                        });
                    }
                    // Mark all as read
                    const maxTs = unread.reduce((max, m) => m.timestamp > max ? m.timestamp : max, '');
                    if (maxTs)
                        markRead(teamName, agentName, maxTs);
                }
            }
            // Call LLM — 4-path routing: stream/non-stream × REPL/Web
            // Feature 1 (P4): Pass native tools to the API
            // Feature 4 (P4): Pass systemContentBlocks with cache_control for prompt caching
            // Feature 8 (P4): Use assembleToolPool to dedup MCP tools (mirrors Claude Code src/tools.ts)
            const pool = assembleToolPool();
            const nativeTools = toolsToNativeSchemas(pool);
            const llmRequest = {
                model: modelId,
                messages: messages,
                maxTokens: session.modelConfig.maxTokens ?? 4096,
                temperature: session.modelConfig.temperature ?? 0.7,
                thinkingMode: effectiveThinkingMode,
                tools: nativeTools.length > 0 ? nativeTools : undefined,
                tool_choice: nativeTools.length > 0 ? { type: 'auto' } : undefined,
                systemContentBlocks: systemContentBlocks.length > 0 ? systemContentBlocks : undefined,
            };
            let response;
            const useStreaming = stream && onToken && turn === 1;
            if (useStreaming) {
                // Streaming path (turn 1 only — mirrors Claude Code: stream for instant UX, then non-streaming for tool loops)
                try {
                    const streamGen = callLLMStream(rc, llmRequest);
                    let streamedResponse = null;
                    for await (const event of streamGen) {
                        if (event.type === 'thinking') {
                            if (config.onThinking)
                                config.onThinking(event.thinking || '');
                        }
                        else if (event.type === 'token') {
                            onToken(event.text || '');
                        }
                        else if (event.type === 'done') {
                            streamedResponse = event.response;
                        }
                        else if (event.type === 'error') {
                            throw new LlmError(event.error || 'Stream error', 0, providerId);
                        }
                    }
                    if (!streamedResponse)
                        throw new LlmError('Stream ended without done event', 0, providerId);
                    response = streamedResponse;
                }
                catch (streamErr) {
                    // Stream failed → fallback to non-streaming
                    const errMsg = streamErr instanceof Error ? streamErr.message : String(streamErr);
                    console.warn(`[AgentRunner] Stream failed (${errMsg}), falling back to non-streaming`);
                    response = await fallbackLLMCall(llmRequest);
                }
            }
            else {
                // Non-streaming path (subsequent turns or streaming disabled)
                response = await fallbackLLMCall(llmRequest);
            }
            // Feature 1 (P4): Prefer native tool_use blocks, fallback to XML parsing
            const toolCalls = response.toolCalls && response.toolCalls.length > 0
                ? response.toolCalls.filter((tc) => findTool(tc.name) !== undefined)
                : parseToolCalls(null, response.content, new Set(pool.map((t) => t.name)));
            // P0 fix: Detect empty tool_calls (LLM returned [] array) vs no tool calls.
            // B6 fix: use a local tracking variable to avoid state leakage across config reuse.
            if (response.toolCalls && response.toolCalls.length === 0 && toolCalls.length === 0) {
                _emptyToolCallCount = (_emptyToolCallCount ?? 0) + 1;
                if (_emptyToolCallCount >= 3) {
                    return {
                        finalResponse: '连续 3 轮返回空工具调用，已终止。请重新描述你的需求。',
                        turnsUsed: turn,
                        toolCallsMade,
                    };
                }
                // Inject hint to LLM on first empty call
                if (_emptyToolCallCount === 1) {
                    addMessage(session, 'user', '[System] 你返回了空的 tool_calls 数组。如果需要执行操作，请调用相应工具；如果任务已完成，请给出最终回复。');
                }
                continue;
            }
            else {
                // Reset counter when valid tool calls are made
                _emptyToolCallCount = 0;
            }
            // Track last non-empty response for finalResult (fix: empty final turn loses streaming text)
            if (response.content && response.content.trim()) {
                finalResponse = response.content;
            }
            if (toolCalls.length > 0) {
                // Feature 1 (P4): Record assistant message with tool_calls metadata
                const assistantMsg = { role: 'assistant', content: response.content, timestamp: new Date().toISOString() };
                if (response.toolCalls && response.toolCalls.length > 0) {
                    assistantMsg.tool_calls = response.toolCalls;
                }
                addMessage(session, 'assistant', response.content);
                onTurn?.(turn, response.content, toolCalls);
                let firstApproval = null;
                for (const tc of toolCalls) {
                    const result = await runToolUse({ toolName: tc.name, rawInput: tc.input, context: toolContext });
                    onToolUse?.(tc.name, tc.input, { content: result.content, isError: !!result.isError });
                    // Feature 1 (P4): Record tool result as user message (Anthropic requirement)
                    addMessage(session, 'user', `[Tool Result: ${tc.name}]\n${result.content}`);
                    toolCallsMade++;
                    // Feature 1 (P5): AskUserQuestion — always checked first, takes priority over permission gates.
                    // If both AskUserQuestion and a permission-requiring tool appear in the same turn,
                    // the user question is surfaced first; permission is re-requested next turn.
                    if (tc.name === 'AskUserQuestion' && toolContext.__needsUserInput) {
                        const pending = toolContext.__needsUserInput;
                        delete toolContext.__needsUserInput;
                        // P1 fix: Signal to Stop hooks that user interaction is pending
                        setPendingUserQuestion(true, session.id);
                        clearAgentLLMBridge();
                        return {
                            finalResponse: response.content,
                            turnsUsed: turn,
                            toolCallsMade,
                            needsUserInput: pending,
                        };
                    }
                    // Phase 3: Permission pipeline — collect but defer return so AskUserQuestion
                    // (if present later in the same turn) is not shadowed.
                    if (result.needsApproval && !firstApproval) {
                        firstApproval = {
                            toolName: tc.name,
                            toolCallId: tc.id,
                            input: tc.input,
                            message: result.content,
                        };
                    }
                }
                // After processing all tools: if we found a permission gate (and no AskUserQuestion
                // caused an early return), pause for user approval now.
                if (firstApproval) {
                    clearAgentLLMBridge();
                    return {
                        finalResponse: `Awaiting permission approval for ${firstApproval.toolName}`,
                        turnsUsed: turn,
                        toolCallsMade,
                        needsApproval: firstApproval,
                    };
                }
                continue; // Next turn
            }
            // No tool calls — check for truncation before declaring final
            // Mirrors Claude Code query/tokenBudget.ts checkTokenBudget() + query.ts budget loop
            const content = response.content || '';
            const completionTokens = response.usage?.completionTokens ?? 0;
            const outputMaxTokens = session.modelConfig.maxTokens ?? 4096;
            const pct = Math.round((completionTokens / outputMaxTokens) * 100);
            const truncatedByTokenLimit = completionTokens >= outputMaxTokens * 0.9;
            const endsAbruptly = content && !/[。！？.!?)\]」』"\n]+$/.test(content.trim());
            // Diminishing returns: after 3+ continues, if delta < 500 tokens → stop
            const deltaSinceLast = completionTokens - lastCompletionTokens;
            const isDiminishing = consecutiveTruncations >= 3 &&
                deltaSinceLast < 500 &&
                lastCompletionTokens > 0;
            if (truncatedByTokenLimit &&
                endsAbruptly &&
                !isDiminishing &&
                consecutiveTruncations < 5) {
                consecutiveTruncations++;
                lastCompletionTokens = completionTokens;
                // Auto-continue: append nudge message and loop
                const nudge = `Stopped at ${pct}% of token limit (${completionTokens.toLocaleString()} / ${outputMaxTokens.toLocaleString()}). Keep working — do not summarize.`;
                addMessage(session, 'assistant', content);
                addMessage(session, 'user', nudge);
                onTurn?.(turn, content, undefined);
                onError?.(`Output truncated at ${completionTokens} tokens, auto-continuing (${consecutiveTruncations}/5)...`);
                continue;
            }
            // Natural end — final response
            addMessage(session, 'assistant', content);
            // P3.4: Record per-message usage
            if (response.usage) {
                const msg = session.messages[session.messages.length - 1];
                msg.usage = {
                    promptTokens: response.usage.promptTokens,
                    completionTokens: response.usage.completionTokens,
                    totalTokens: response.usage.totalTokens,
                    cost: calculateCost(response.model, response.usage.promptTokens, response.usage.completionTokens),
                };
            }
            onTurn?.(turn, content);
            finalResponse = response.content;
            break;
        }
    }
    catch (err) {
        let msg;
        if (err instanceof LlmError) {
            // formatError already includes status annotation — just wrap it
            msg = `请求失败: ${err.message}`;
        }
        else {
            msg = `Agent call failed: ${err.message}`;
        }
        onError?.(msg);
        return { finalResponse, turnsUsed: turn, toolCallsMade, error: msg };
    }
    finally {
        clearAgentLLMBridge();
    }
    return { finalResponse, turnsUsed: turn, toolCallsMade };
}
//# sourceMappingURL=agent-runner.js.map