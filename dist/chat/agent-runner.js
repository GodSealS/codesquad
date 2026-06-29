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
import { microCompactWithSession } from '../context/micro-compact.js';
import { incrementTurn, shouldAutoCompact, autoCompact } from '../context/auto-compact.js';
import { parseToolCalls } from '../tools/response-parser.js';
import { toolsToNativeSchemas } from '../tools/schema-converter.js';
import { chatModeToPermissionMode } from '../permissions/mode.js';
import { virtualReadFile } from '../embedded/virtual-fs.js';
import { setAgentLLMBridge, clearAgentLLMBridge } from '../agents/bridge.js';
import { setPendingUserQuestion } from '../hooks/executor.js';
import { consumeForkSkill, createEphemeralSession } from '../context/fork-executor.js';
import { logDiagnostic } from '../utils/error-logger.js';
// Team mailbox polling (Feature 3.5 — P4)
import { getUnreadMessages, markRead } from '../teams/mailbox.js';
// Defensive execution (S02): mid-conversation checkpoint + emergency save
import { saveCheckpoint, emergencySave } from './checkpoint.js';
import { save } from './session.js';
// Defensive execution (S07): tool pairing guard before API calls
import { ensureToolResultPairing } from '../tools/pairing-guard.js';
// ── Fork Skill Execution ──
/**
 * Execute a fork skill in an isolated ephemeral session.
 *
 * Creates a throwaway session with only the skill instructions, runs the LLM
 * with full tool access for up to FORK_MAX_TURNS, and returns a summary
 * suitable for injection back into the parent session.
 */
async function executeForkSkill(pending, config, rc, messages, parentSession, onError) {
    const FORK_MAX_TURNS = 15;
    const FORK_MAX_RETRIES = 3; // S08: retry entire fork up to 3 times
    const FORK_MAX_TOKENS = 8192; // S08: upgraded from 4096
    const FORK_TIMEOUT_MS = 60_000; // S08: per-turn timeout
    let retryCount = 0;
    while (retryCount < FORK_MAX_RETRIES) {
        try {
            // Build system prompt for fork execution
            const forkSystem = [
                `You are executing a skill in an isolated context.`,
                `Skill: ${pending.skillName}`,
                pending.args ? `Arguments: ${pending.args}` : '',
                ``,
                `Follow the skill instructions below. You have access to all tools.`,
                `When the task is complete, provide a clear summary of what was done.`,
                ``,
                `─── SKILL INSTRUCTIONS ───`,
                pending.content,
                ``,
                `─── END SKILL ───`,
            ].filter(Boolean).join('\n');
            // Create ephemeral session
            const forkSession = createEphemeralSession(`fork:${pending.skillName}`, pending.model ? { ...parentSession.modelConfig, model: pending.model } : parentSession.modelConfig);
            // Build fork context
            const forkContext = {
                session: forkSession,
                cwd: config.projectRoot,
                projectRoot: config.projectRoot,
                aicoreDir: config.aicoreDir,
                abortSignal: new AbortController().signal,
                permissionMode: chatModeToPermissionMode(config.mode),
                readFileState: getSessionCache(),
                headless: true,
            };
            // Fork execution: send skill as system + simple user message
            const forkMessages = [
                { role: 'system', content: forkSystem },
                { role: 'user', content: pending.args
                        ? `Execute the skill "${pending.skillName}" with arguments: ${pending.args}`
                        : `Execute the skill "${pending.skillName}". Begin working through the instructions above.`
                },
            ];
            let forkTurns = 0;
            let lastResponse = '';
            const partialResults = []; // S08: track intermediate results
            const forkModel = pending.model || config.modelId;
            while (forkTurns < FORK_MAX_TURNS) {
                forkTurns++;
                // S08: per-turn timeout — timeout doesn't kill fork, just skips turn
                const timeoutController = new AbortController();
                const timeoutId = setTimeout(() => timeoutController.abort(), FORK_TIMEOUT_MS);
                let forkResp;
                try {
                    forkResp = await callLLM(rc, {
                        model: forkModel,
                        messages: forkMessages,
                        maxTokens: FORK_MAX_TOKENS,
                        temperature: 0.7,
                        signal: timeoutController.signal,
                    });
                }
                catch (innerErr) {
                    clearTimeout(timeoutId);
                    // S08: AbortError from fetch() becomes LlmError(status=0) in callLLM.
                    // Check the message instead of .name since it gets wrapped.
                    const errMsg = innerErr.message?.toLowerCase() ?? '';
                    if (errMsg.includes('abort') || errMsg.includes('timeout')) {
                        partialResults.push(`[Turn ${forkTurns}] Timed out — continuing`);
                        continue; // timeout doesn't kill fork
                    }
                    throw innerErr;
                }
                clearTimeout(timeoutId);
                if (!forkResp.content || forkResp.content.trim().length === 0) {
                    partialResults.push(`[Turn ${forkTurns}] Empty response — continuing`);
                    continue; // S08: empty response doesn't kill fork
                }
                lastResponse = forkResp.content;
                // Parse tool calls from fork response
                const pool = assembleToolPool();
                const toolCalls = parseToolCalls(null, forkResp.content, new Set(pool.map(t => t.name)));
                if (toolCalls.length > 0) {
                    forkMessages.push({ role: 'assistant', content: forkResp.content });
                    partialResults.push(`[Turn ${forkTurns}] Executed ${toolCalls.length} tool(s): ${toolCalls.map(t => t.name).join(', ')}`);
                    for (const tc of toolCalls) {
                        try {
                            const result = await runToolUse({
                                toolName: tc.name,
                                rawInput: tc.input,
                                context: forkContext,
                            });
                            forkMessages.push({
                                role: 'user',
                                content: `[Tool Result: ${tc.name}]\n${result.content}`,
                            });
                        }
                        catch (toolErr) {
                            // S08: tool error injected as context, doesn't kill fork
                            forkMessages.push({
                                role: 'user',
                                content: `[Tool Error: ${tc.name}]\n${toolErr.message}`,
                            });
                        }
                    }
                    continue;
                }
                // No tool calls — fork skill is done
                const summary = forkResp.content.slice(0, 3000);
                return [
                    `## Fork Skill Result: ${pending.skillName}`,
                    pending.args ? `_Arguments: ${pending.args}_` : '',
                    `_Completed in ${forkTurns} turn(s)_`,
                    partialResults.length > 0 ? `\n### Execution Log\n${partialResults.join('\n')}` : '',
                    '',
                    '---',
                    '',
                    summary,
                    forkResp.content.length > 3000 ? '\n\n... (truncated)' : '',
                ].filter(Boolean).join('\n');
            }
            // S08: maxTurns reached — preserve intermediate results + last response
            const lastSummary = lastResponse ? lastResponse.slice(0, 2000) : '(no output)';
            return [
                `## Fork Skill Result: ${pending.skillName}`,
                `_⚠️ Reached max turns (${FORK_MAX_TURNS}) — execution was truncated_`,
                `_Last output (${forkTurns} turns):_`,
                '',
                '---',
                '',
                lastSummary,
                '',
                partialResults.length > 0 ? `\n### Partial Execution Log\n${partialResults.join('\n')}` : '',
                '',
                'The skill did not complete within the allowed turn limit. The parent agent may re-trigger it.',
            ].filter(Boolean).join('\n');
        }
        catch (err) {
            retryCount++;
            const isRetryable = isForkErrorRetryable(err);
            if (isRetryable && retryCount < FORK_MAX_RETRIES) {
                onError?.(`Fork "${pending.skillName}" failed (retryable), attempt ${retryCount}/${FORK_MAX_RETRIES}: ${err.message}`);
                continue;
            }
            onError?.(`Fork skill "${pending.skillName}" failed: ${err.message}`);
            return [
                `## Fork Skill Error: ${pending.skillName}`,
                '',
                `Execution failed${retryCount > 1 ? ` after ${retryCount} attempt(s)` : ''}: ${err.message.slice(0, 500)}`,
            ].join('\n');
        }
    }
    return [
        `## Fork Skill Error: ${pending.skillName}`,
        '',
        `All ${FORK_MAX_RETRIES} retry attempts exhausted.`,
    ].join('\n');
}
/** S08: determine if a fork error is retryable. */
function isForkErrorRetryable(err) {
    if (err instanceof LlmError) {
        return err.status === 429 || err.status === 0 || err.status === 503 || err.status === 502;
    }
    const code = err.code;
    if (code) {
        return ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'EPIPE'].includes(code);
    }
    const msg = err.message?.toLowerCase() ?? '';
    return msg.includes('timeout') || msg.includes('network') || msg.includes('fetch failed');
}
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
    // Fix: reset per-session turn counter at the start of each runAgent call
    // to prevent conflict between incrementTurn() and session.turnCount = turn
    session.turnCount = 0;
    let turn = 0;
    let toolCallsMade = 0;
    let consecutiveTruncations = 0;
    let lastCompletionTokens = 0;
    let finalResponse = '';
    let _emptyToolCallCount = 0; // B6 fix: local var instead of mutating config
    // S06: dynamic maxTokens that can be escalated on truncation
    const MAX_OUTPUT_ESCALATED = 16_384;
    let currentMaxTokens = session.modelConfig.maxTokens ?? 4096;
    // P1 fix: Reset pending user question flag at session start
    setPendingUserQuestion(false, session.id);
    // S01: 429 rate-limit retry constants
    const MAX_429_RETRIES = 3;
    const BASE_RETRY_DELAY_MS = 1000;
    // Helper: route through appropriate LLM path (REPL fallback chain or Web direct call)
    async function fallbackLLMCall(req) {
        // S01: 429 rate-limit retry with exponential backoff
        let lastError = null;
        for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
            try {
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
            catch (err) {
                lastError = err;
                // Only retry on rate-limit (429) or temporary server errors
                if (err instanceof LlmError && (err.status === 429 || err.status === 503 || err.status === 502)) {
                    if (attempt < MAX_429_RETRIES) {
                        const delayMs = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt), 30_000);
                        logDiagnostic('WARN', 'agent-runner', `LLM retry ${attempt + 1}/${MAX_429_RETRIES} after ${delayMs}ms (status ${err.status})`, {
                            sessionId: session.id, turn,
                        });
                        await new Promise(r => setTimeout(r, delayMs));
                        continue;
                    }
                }
                // Non-retryable error or retries exhausted → throw
                throw lastError;
            }
        }
        throw lastError ?? new Error('LLM call failed after retries');
    }
    try {
        let compactFailed = false;
        while (turn < maxTurns) {
            turn++;
            incrementTurn(session);
            // Phase 6.1: Auto-compact check at the start of each turn
            if (!compactFailed && turn > 1 && session.messages.length >= 10) {
                const check = shouldAutoCompact(session.messages, modelId, session);
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
            // ── Language instruction: placed FIRST for highest priority ──
            // Must precede the English agent prompt so LLM doesn't default to English persona.
            const langInstruction = lang === 'zh'
                ? '## ⚠️ 响应语言（最高优先级）\n**你必须使用简体中文回复。** 所有文本输出、思考过程、推理、代码注释、工具调用说明都必须使用中文。仅代码标识符和技术术语可保留英文。\n\n---'
                : '';
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
            // Feature 4 (P4): Build systemContentBlocks with cache_control
            // Fix: langInstruction is always the FIRST block (before agent prompt) to prevent
            // the English agent persona from overriding the language directive.
            const systemContentBlocks = [];
            if (langInstruction) {
                systemContentBlocks.push({ type: 'text', text: langInstruction });
            }
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
            // ── Fork Skill Execution ──
            // When a skill with `context: fork` was activated (via SkillTool or chat-v2),
            // execute it in an ephemeral isolated session and inject only the summary.
            const pendingFork = consumeForkSkill(session);
            if (pendingFork) {
                const forkSummary = await executeForkSkill(pendingFork, config, rc, messages, session, onError);
                if (forkSummary) {
                    // Replace injectedContent with the fork execution summary
                    // so the parent LLM sees only the condensed result
                    session.context.injectedContent = forkSummary;
                }
            }
            // Context files
            if (session.context.injectedContent) {
                const { sanitizeAicorePaths, expandAicoreRefs } = await import('../embedded/virtual-fs.js');
                const safeContent = expandAicoreRefs(sanitizeAicorePaths(session.context.injectedContent));
                messages.push({
                    role: 'user', content: `[上下文文件]\n${safeContent.slice(0, 50000)}`,
                    timestamp: new Date().toISOString(),
                });
            }
            // History (last 40, skip system) — Feature 5 (P4): apply micro-compact
            // Fix: increased from 20 to 40 to prevent pairing-guard orphan tool_results
            // (assistant tool_use messages need to be in the same window as their tool_results)
            const historyMsgs = [];
            for (const msg of session.messages.slice(-40)) {
                if (msg.role === 'system')
                    continue;
                const hm = {
                    role: msg.role, content: msg.content, timestamp: msg.timestamp,
                };
                if (msg.tool_calls)
                    hm.tool_calls = msg.tool_calls;
                historyMsgs.push(hm);
            }
            // Compact old tool results to save tokens (S09: tool-type filtering + time trigger)
            microCompactWithSession(historyMsgs, session);
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
            // S07: ensure tool_use/tool_result pairing before API call
            const { messages: safeMessages, fixesApplied } = ensureToolResultPairing(messages, new Set(pool.map(t => t.name)));
            if (fixesApplied > 0) {
                logDiagnostic('WARN', 'agent-runner', `pairing guard fixed ${fixesApplied} issue(s)`, {
                    sessionId: session.id, turn,
                });
            }
            const nativeTools = toolsToNativeSchemas(pool);
            const llmRequest = {
                model: modelId,
                messages: safeMessages,
                maxTokens: currentMaxTokens,
                temperature: session.modelConfig.temperature ?? 0.7,
                thinkingMode: effectiveThinkingMode,
                tools: nativeTools.length > 0 ? nativeTools : undefined,
                tool_choice: nativeTools.length > 0 ? { type: 'auto' } : undefined,
                systemContentBlocks: systemContentBlocks.length > 0 ? systemContentBlocks : undefined,
            };
            let response;
            const useStreaming = stream && onToken && turn === 1;
            let streamedResponse = null;
            if (useStreaming) {
                // Streaming path (turn 1 only — mirrors Claude Code: stream for instant UX, then non-streaming for tool loops)
                try {
                    const streamGen = callLLMStream(rc, llmRequest);
                    let streamed = null;
                    for await (const event of streamGen) {
                        if (event.type === 'thinking') {
                            if (config.onThinking)
                                config.onThinking(event.thinking || '');
                        }
                        else if (event.type === 'token') {
                            onToken(event.text || '');
                        }
                        else if (event.type === 'done') {
                            streamed = event.response;
                        }
                        else if (event.type === 'error') {
                            throw new LlmError(event.error || 'Stream error', 0, providerId);
                        }
                    }
                    if (!streamed)
                        throw new LlmError('Stream ended without done event', 0, providerId);
                    response = streamed;
                    streamedResponse = streamed;
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
            // P2 fix: Push non-streaming (or stream-fallback) turn content to frontend via onToken.
            // Without this, the frontend shows only Turn 1's streaming tokens (e.g. 47 chars)
            // while Turns 2+ execute tools in silence. With 4 turns and 10 tool calls,
            // the user sees stale text for minutes → UI looks frozen → text "disappears".
            if (!streamedResponse && onToken && response.content) {
                onToken(response.content);
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
                // Fix: push directly to session to preserve tool_calls — addMessage() drops metadata
                const assistantMsg = { role: 'assistant', content: response.content, timestamp: new Date().toISOString() };
                if (response.toolCalls && response.toolCalls.length > 0) {
                    assistantMsg.tool_calls = response.toolCalls;
                }
                session.messages.push(assistantMsg);
                session.updatedAt = assistantMsg.timestamp;
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
                        console.warn('[AgentRunner] AskUserQuestion triggered — pausing for user input. This will clear frontend streaming display.');
                        logDiagnostic('WARN', 'agent-runner', 'AskUserQuestion triggered', {
                            sessionId: session.id,
                            questions: toolContext.__needsUserInput?.questions?.length,
                        });
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
                // S02: checkpoint save every 5 turns (after tools execute, before next iteration)
                if (turn % 5 === 0) {
                    saveCheckpoint(session, turn);
                }
                // S05: update per-session turn counter
                session.turnCount = turn;
                // S09: track last assistant timestamp
                session.lastAssistantTimestamp = new Date().toISOString();
                continue; // Next turn
            }
            // No tool calls — check for truncation before declaring final
            // Mirrors Claude Code query/tokenBudget.ts checkTokenBudget() + query.ts budget loop
            const content = response.content || '';
            const completionTokens = response.usage?.completionTokens ?? 0;
            const outputMaxTokens = currentMaxTokens;
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
                // S06: escalate maxTokens on first truncation (mirrors Claude Code max_output_tokens_escalate)
                if (consecutiveTruncations === 1 && currentMaxTokens < MAX_OUTPUT_ESCALATED) {
                    const prevMax = currentMaxTokens;
                    currentMaxTokens = MAX_OUTPUT_ESCALATED;
                    const escalateMsg = `Output capped at ${prevMax} tokens. Escalated maxTokens to ${MAX_OUTPUT_ESCALATED}. Continue.`;
                    addMessage(session, 'assistant', content);
                    addMessage(session, 'user', escalateMsg);
                    session.lastAssistantTimestamp = new Date().toISOString();
                    onTurn?.(turn, content, undefined);
                    onError?.(`Output truncated at ${completionTokens} tokens, escalating maxTokens (${prevMax} → ${MAX_OUTPUT_ESCALATED})...`);
                    continue;
                }
                // S06: subsequent truncations → nudge to continue (mirrors Claude Code token_budget_continuation)
                const nudge = `Stopped at ${pct}% of token limit (${completionTokens.toLocaleString()} / ${outputMaxTokens.toLocaleString()}). Keep working — do not summarize.`;
                addMessage(session, 'assistant', content);
                addMessage(session, 'user', nudge);
                session.lastAssistantTimestamp = new Date().toISOString();
                onTurn?.(turn, content, undefined);
                onError?.(`Output truncated at ${completionTokens} tokens, auto-continuing (${consecutiveTruncations}/5)...`);
                // S02: checkpoint on truncation continue
                if (consecutiveTruncations % 2 === 0) {
                    saveCheckpoint(session, turn);
                }
                continue;
            }
            // Natural end — final response
            addMessage(session, 'assistant', content);
            session.lastAssistantTimestamp = new Date().toISOString();
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
        logDiagnostic('ERROR', 'agent-runner', 'runAgent error', {
            error: msg,
            finalResponseLen: finalResponse?.length ?? 0,
            turnsUsed: turn,
            toolCallsMade,
        });
        // S02: emergency save on abnormal exit — don't lose conversation progress
        emergencySave(session);
        return { finalResponse, turnsUsed: turn, toolCallsMade, error: msg };
    }
    finally {
        clearAgentLLMBridge();
    }
    // S02: final save on normal completion
    try {
        await save(session);
    }
    catch { /* best-effort */ }
    logDiagnostic('INFO', 'agent-runner', 'runAgent returning finalResponse', {
        finalResponseLen: finalResponse?.length ?? 0,
        finalResponseStart: finalResponse.slice(0, 200),
        turnsUsed: turn,
        toolCallsMade,
    });
    return { finalResponse, turnsUsed: turn, toolCallsMade };
}
//# sourceMappingURL=agent-runner.js.map