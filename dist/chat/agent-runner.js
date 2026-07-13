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
import { executeToolBatch, resetToolQueue, onToolProgress as subscribeToolProgress } from '../tools/execution-queue.js';
import { touchTool } from '../tools/dynamic-registry.js';
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
// Semantic context retrieval (Step 5)
import { loadSettings } from './settings.js';
import { isSemanticEnabled, getEmbeddingProvider } from '../embedding/provider.js';
import { assembleSemanticContext } from '../context/semantic-context.js';
import { summarizeMessageAsync } from '../embedding/summarizer.js';
import { countTokens } from './tokenizer.js';
import { getContextWindow } from '../context/auto-compact.js';
// Session Memory integration (M7)
import { initSessionMemory, shouldExtractMemory, recordToolCall, markExtractionStarted, extractSessionMemoryViaMode, resolveSideQueryConfig, } from '../memory/session-memory.js';
// Agent Memory integration (M7)
import { loadAgentMemoryPrompt, } from '../memory/agent-memory.js';
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
            // Fix: inject language instruction so fork respects UI language setting
            const forkLangPrompt = config.lang === 'zh'
                ? '**你必须使用简体中文回复。** 所有文本输出、思考、工具调用说明必须用中文。'
                : '';
            const forkSystem = [
                forkLangPrompt,
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
                // Parse tool calls from fork response.
                // S04: Filter Agent and TodoWrite from fork skill tool pool to prevent
                // recursive agent nesting (fork skill → AgentTool → sub-agent → ...).
                const FORK_DISALLOWED_TOOLS = new Set(['Agent', 'TodoWrite']);
                const pool = assembleToolPool().filter(t => !FORK_DISALLOWED_TOOLS.has(t.name));
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
    const startTime = Date.now();
    const { agentName, userInput, session, providerId, modelId, projectRoot, aicoreDir, mode, maxTurns = 20, lang = 'zh', runtimeConfig: configRuntimeConfig, stream = false, onToken, onTurn, onToolUse, onToolProgress, onError, } = config;
    // ── Session Memory setup (M7) ──
    const querySource = config.querySource ?? 'repl_main_thread';
    const autoCompactEnabled = true; // always enabled for now
    initSessionMemory(session.id);
    // ── Load agent path and content ──
    const agentPath = join(aicoreDir, 'agents', `${agentName}.md`);
    let rawAgent;
    try {
        rawAgent = virtualReadFile(agentPath, 'utf-8');
    }
    catch {
        throw new Error(`Agent not found: ${agentName}`);
    }
    // ── Agent Memory injection (M7) ──
    let agentMemoryPrompt = '';
    try {
        // Check if agent frontmatter has memory field
        const memMatch = rawAgent.match(/^memory\s*:\s*(.+)$/m);
        if (memMatch) {
            const memScope = (memMatch[1].trim() === 'local' || memMatch[1].trim() === 'project' || memMatch[1].trim() === 'user')
                ? memMatch[1].trim()
                : null;
            if (memScope) {
                // Check for instanceId
                const instanceMatch = rawAgent.match(/^instanceId\s*:\s*(.+)$/m);
                const instanceId = instanceMatch?.[1]?.trim();
                agentMemoryPrompt = loadAgentMemoryPrompt(agentName, memScope, instanceId);
            }
        }
    }
    catch {
        // Ignore — agent memory is optional
    }
    const agentPrompt = rawAgent;
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
    // 🔧 Bug Fix #2: fire-and-forget 摘要生成 → 写入 VectorStore
    summarizeMessageAsync({ role: 'user', content: userInput }, session.id, session.messages.length - 1);
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
    let accumulatedResponseText = ''; // accumulates text across all turns for progressive frontend display
    let _emptyToolCallCount = 0; // B6 fix: local var instead of mutating config
    // S06: dynamic maxTokens that can be escalated on truncation
    const MAX_OUTPUT_ESCALATED = 16_384;
    let currentMaxTokens = session.modelConfig.maxTokens ?? 4096;
    // P1 fix: Reset pending user question flag at session start
    setPendingUserQuestion(false, session.id);
    // S01: 429 rate-limit retry constants
    const MAX_RETRIES_REGULAR = 3; // 429/503/non-upstream 502
    const MAX_RETRIES_UPSTREAM = 5; // upstream 502 — wait longer for backend recovery
    const BASE_RETRY_DELAY_MS = 1000;
    // Helper: route through appropriate LLM path (REPL fallback chain or Web direct call)
    async function fallbackLLMCall(req) {
        // S01: 429 rate-limit retry with exponential backoff
        let lastError = null;
        const isWebPath = !!configRuntimeConfig;
        let payload = req; // mutable for 502 context trimming
        let consecutive502 = 0;
        let isUpstream502 = false; // set on first upstream_error detection
        // Inter-call spacing: enforce minimum 250ms between API calls to avoid proxy rate limits
        let _lastCallTime = 0;
        const MIN_CALL_INTERVAL_MS = 250;
        // ── Rate-limit tracking: sliding 60-second window ──
        const callTimestamps = [];
        const RATE_WINDOW_MS = 60_000;
        const RATE_WARN_THRESHOLD = 15; // warn when >15 calls in 60s
        const RATE_CRITICAL_THRESHOLD = 25; // critical when >25 calls in 60s
        function trackCallRate() {
            const now = Date.now();
            callTimestamps.push(now);
            // Trim expired entries
            while (callTimestamps.length > 0 && callTimestamps[0] < now - RATE_WINDOW_MS) {
                callTimestamps.shift();
            }
            const count = callTimestamps.length;
            const rate = count / (RATE_WINDOW_MS / 60_000); // calls per minute
            return { count, rate };
        }
        // P0 guard: warn if context is suspiciously large before first API call
        const msgCount = req.messages?.length ?? 0;
        const sysBlocksTotalChars = req.systemContentBlocks
            ?.reduce((sum, b) => sum + (b.text?.length ?? 0), 0) ?? 0;
        const toolsCount = req.tools?.length ?? 0;
        // Estimate total request body size (chars ≈ bytes for UTF-8 text)
        const estBodySize = sysBlocksTotalChars + msgCount * 2000; // ~500 tokens/msg avg
        if (estBodySize > 200_000 || msgCount > 50) {
            logDiagnostic('WARN', 'agent-runner', `Large request (est ${(estBodySize / 1024).toFixed(0)}KB, ${msgCount} msgs, ${toolsCount} tools) — risk of 502`, {
                sessionId: session.id, turn, msgCount, sysBlocksTotalChars, toolsCount,
            });
        }
        // Determine max retries based on error type (updated per-attempt below)
        let maxRetries = MAX_RETRIES_REGULAR;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            // Enforce minimum inter-call spacing to prevent proxy rate limiting
            const now = Date.now();
            const sinceLast = now - _lastCallTime;
            if (sinceLast < MIN_CALL_INTERVAL_MS && _lastCallTime > 0) {
                await new Promise(r => setTimeout(r, MIN_CALL_INTERVAL_MS - sinceLast));
            }
            _lastCallTime = Date.now();
            // ── Pre-call rate-limit check ──
            const rateInfo = trackCallRate();
            if (rateInfo.count >= RATE_CRITICAL_THRESHOLD) {
                logDiagnostic('WARN', 'agent-runner', `Rate-limit critical: ${rateInfo.count} calls in ${RATE_WINDOW_MS / 1000}s (${rateInfo.rate.toFixed(1)} RPM) — adding extra delay`, {
                    sessionId: session.id, turn, attempt, count: rateInfo.count, rpm: rateInfo.rate.toFixed(1),
                });
                // Add extra delay proportional to rate
                const extraDelay = Math.min(rateInfo.count * 200, 5000);
                await new Promise(r => setTimeout(r, extraDelay));
            }
            else if (rateInfo.count >= RATE_WARN_THRESHOLD) {
                logDiagnostic('WARN', 'agent-runner', `Rate-limit approaching: ${rateInfo.count} calls in ${RATE_WINDOW_MS / 1000}s (${rateInfo.rate.toFixed(1)} RPM)`, {
                    sessionId: session.id, turn, attempt, count: rateInfo.count, rpm: rateInfo.rate.toFixed(1),
                });
            }
            try {
                if (isWebPath) {
                    return await callLLM(rc, payload);
                }
                else {
                    const routed = await callWithFallback(payload, providerId, modelId, projectRoot);
                    return { content: routed.content, model: routed.model, usage: routed.usage, toolCalls: routed.toolCalls };
                }
            }
            catch (err) {
                lastError = err;
                const isRetryable = err instanceof LlmError && (err.status === 429 || err.status === 503 || err.status === 502);
                if (isRetryable) {
                    // ── 502: proxy unreachable / upstream error ──
                    if (err instanceof LlmError && err.status === 502) {
                        consecutive502++;
                        // Detect upstream (backend model provider) vs proxy error
                        if (!isUpstream502 && err.isUpstreamError()) {
                            isUpstream502 = true;
                            maxRetries = MAX_RETRIES_UPSTREAM;
                            logDiagnostic('WARN', 'agent-runner', `502 detected as upstream_error (source: DeepSeek backend) — extending retries to ${MAX_RETRIES_UPSTREAM} with exponential backoff`, {
                                sessionId: session.id, turn, consecutive502,
                            });
                        }
                        // Log detailed diagnostics for 502 troubleshooting
                        const diagCtx = {
                            sessionId: session.id, turn, attempt, consecutive502,
                            model: modelId, provider: rc.name, providerId: rc.id,
                            baseUrl: rc.baseUrl || 'unknown',
                            msgCount: payload.messages?.length ?? 0,
                            sysBlocks: payload.systemContentBlocks?.length ?? 0,
                            toolsCount: payload.tools?.length ?? 0,
                            thinkingMode: payload.thinkingMode || 'default',
                            isUpstream: isUpstream502,
                            rateWindow: `${trackCallRate().count} calls/${RATE_WINDOW_MS / 1000}s`,
                        };
                        logDiagnostic('WARN', 'agent-runner', `502 #${consecutive502} — ${rc.name} @ ${diagCtx.baseUrl}${isUpstream502 ? ' [UPSTREAM]' : ''}`, diagCtx);
                        // ── Decide retry strategy ──
                        if (isUpstream502) {
                            // Upstream (DeepSeek API) error: trim won't help, just wait and retry
                            if (consecutive502 <= MAX_RETRIES_UPSTREAM) {
                                // Exponential backoff with jitter: 1s, 2s, 4s, 8s, 16s (capped at 30s)
                                const baseDelay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, consecutive502 - 1), 30_000);
                                const jitter = Math.random() * 1000; // ±0-1s random jitter
                                const delayMs = baseDelay + jitter;
                                logDiagnostic('INFO', 'agent-runner', `Upstream 502 retry ${consecutive502}/${MAX_RETRIES_UPSTREAM} — waiting ${(delayMs / 1000).toFixed(1)}s (exponential backoff)`, {
                                    sessionId: session.id, turn, delayMs: Math.round(delayMs),
                                });
                                await new Promise(r => setTimeout(r, delayMs));
                                continue;
                            }
                            // Exhausted all upstream retries
                            logDiagnostic('ERROR', 'agent-runner', `Upstream 502 persists after ${consecutive502} retries (${MAX_RETRIES_UPSTREAM} max) — DeepSeek backend unreachable`, {
                                sessionId: session.id, turn, consecutive502, totalWaitEstimate: '~30s',
                            });
                            throw new LlmError(`TokenHub 代理不可达 (${consecutive502} 次尝试均 502，上游 DeepSeek 服务异常)。请稍后重试。`, 502, rc.name);
                        }
                        // Non-upstream 502: could be transient proxy issue — try trim + retry
                        if (consecutive502 === 1) {
                            await new Promise(r => setTimeout(r, 1000));
                            continue;
                        }
                        if (consecutive502 === 2) {
                            // Second 502: trim request aggressively — truncate both count AND size
                            const rawMsgs = req.messages ?? [];
                            const rawTools = req.tools ?? [];
                            const rawSys = req.systemContentBlocks ?? [];
                            const ogMsgs = rawMsgs.length;
                            const ogTools = rawTools.length;
                            const ogSys = rawSys.length;
                            // Truncate each message to max 4KB, keep last 20
                            const trimmedMsgs = rawMsgs.slice(-20).map((m) => {
                                const content = typeof m.content === 'string' ? m.content : '';
                                if (content.length > 4096) {
                                    return { ...m, content: content.slice(0, 4096) + `\n[... ${content.length - 4096} chars truncated]` };
                                }
                                return m;
                            });
                            // Truncate each sysBlock to max 2KB
                            const trimmedSys = rawSys.slice(-2).map((b) => {
                                const text = typeof b.text === 'string' ? b.text : '';
                                if (text.length > 2048) {
                                    return { type: 'text', text: text.slice(-2048) }; // keep tail (usually has context-specific rules)
                                }
                                return b;
                            });
                            // Estimate trimmed body size for diagnostics
                            const trimmedMsgsChars = trimmedMsgs.reduce((s, m) => s + (typeof m.content === 'string' ? m.content.length : 0), 0);
                            const trimmedSysChars = trimmedSys.reduce((s, b) => s + (typeof b.text === 'string' ? b.text.length : 0), 0);
                            const trimmedToolsChars = JSON.stringify(rawTools.slice(0, 10)).length;
                            const trimmedEstKB = ((trimmedMsgsChars + trimmedSysChars + trimmedToolsChars) / 1024).toFixed(0);
                            logDiagnostic('WARN', 'agent-runner', `502 persists — aggressive trim: msgs ${ogMsgs}→${trimmedMsgs.length}(max 4KB/msg), tools ${ogTools}→10, sysBlocks ${ogSys}→${trimmedSys.length}(max 2KB/block), thinking→fast, est ${trimmedEstKB}KB`, {
                                sessionId: session.id, turn,
                            });
                            payload = {
                                ...req,
                                messages: trimmedMsgs,
                                tools: rawTools.slice(0, 10),
                                systemContentBlocks: trimmedSys,
                                thinkingMode: 'fast',
                            };
                            await new Promise(r => setTimeout(r, 2000));
                            continue;
                        }
                        // Third+ 502: proxy is definitively unreachable — stop wasting time
                        const finalRate = trackCallRate();
                        logDiagnostic('ERROR', 'agent-runner', `502 persists after ${consecutive502} attempts + trimming — TokenHub proxy unreachable`, {
                            sessionId: session.id, turn, consecutive502,
                            model: modelId, baseUrl: rc.baseUrl || 'unknown',
                            finalMsgCount: payload.messages?.length ?? 0,
                            finalToolsCount: payload.tools?.length ?? 0,
                            finalThinkingMode: payload.thinkingMode || 'default',
                            rateWindow: `${finalRate.count} calls/${RATE_WINDOW_MS / 1000}s (${finalRate.rate.toFixed(1)} RPM)`,
                        });
                        throw new LlmError(`TokenHub 代理不可达 (${consecutive502} 次尝试均 502)。请检查网络或稍后重试。`, 502, rc.name);
                    }
                    // ── 429 / 503: standard exponential backoff ──
                    if (attempt < maxRetries) {
                        const delayMs = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt), 30_000);
                        logDiagnostic('WARN', 'agent-runner', `LLM retry ${attempt + 1}/${maxRetries} after ${delayMs}ms (status ${err.status})`, {
                            sessionId: session.id, turn,
                        });
                        await new Promise(r => setTimeout(r, delayMs));
                        continue;
                    }
                    // S02: Retries exhausted for web path 502/503 → don't throw, let fallback chain run
                    if (isWebPath && (err.status === 502 || err.status === 503)) {
                        logDiagnostic('WARN', 'agent-runner', 'LLM retries exhausted — will attempt fallback chain', {
                            sessionId: session.id, turn, model: modelId, status: err.status, attempts: attempt + 1,
                        });
                        break;
                    }
                }
                // Non-retryable error or REPL path retries exhausted → throw immediately
                logDiagnostic('ERROR', 'agent-runner', 'LLM retries exhausted', {
                    sessionId: session.id,
                    turn,
                    model: modelId,
                    provider: rc.name,
                    status: err instanceof LlmError ? err.status : undefined,
                    attempts: attempt + 1,
                    lastError: lastError?.message,
                });
                throw lastError;
            }
        }
        // S02: Web path — primary provider exhausted on 502/503 → try fallback chain
        if (isWebPath && lastError instanceof LlmError && (lastError.status === 502 || lastError.status === 503)) {
            logDiagnostic('WARN', 'agent-runner', 'Primary provider exhausted, attempting fallback chain', {
                sessionId: session.id, turn, primaryProvider: rc.name,
            });
            try {
                // callWithFallback tries the full chain: primary → fallback_chain → Ollama.
                // The primary lookup may skip (web path uses model keys not in the registry),
                // but fallback_chain entries and Ollama will still be attempted.
                // Use trimmed payload if 502 context trimming already applied.
                // Note: cross-session throttling is handled by ApiKeyGateway in client.ts
                const fbPayload = consecutive502 >= 2 ? payload : req;
                const routed = await callWithFallback(fbPayload, rc.id, modelId, projectRoot);
                logDiagnostic('INFO', 'agent-runner', 'Fallback chain succeeded', {
                    sessionId: session.id, routedVia: routed.routedVia,
                });
                return { content: routed.content, model: routed.model, usage: routed.usage, toolCalls: routed.toolCalls };
            }
            catch (fbErr) {
                logDiagnostic('ERROR', 'agent-runner', 'Fallback chain also failed', {
                    sessionId: session.id, turn, error: fbErr.message,
                });
            }
        }
        throw lastError ?? new Error('LLM call failed after retries');
    }
    try {
        let compactFailed = false;
        // 🔧 Bug Fix: loadSettings() 移到循环外，避免每轮重复磁盘 I/O
        const settings = loadSettings();
        const sc = settings.semanticContext;
        // Token 预算：模型最大上下文 × maxGenerationPercent（通用设置，非语义特有）
        const contextWindow = getContextWindow(modelId);
        const maxContextTokens = Math.floor(contextWindow * settings.maxGenerationPercent / 100);
        // 纯时间窗口预算：取 maxContextTokens 的 80%（给语义匹配留空间）
        const timeWindowTokens = Math.floor(maxContextTokens * 0.8);
        let shutdownRequested = false;
        while (turn < maxTurns) {
            if (shutdownRequested)
                break;
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
            // Cap systemContentBlocks: merge excessive blocks into a single block
            // to avoid bloating the request body with 20+ independent cache_control blocks.
            // TokenHub proxy struggles with large system arrays.
            const MAX_SYS_BLOCKS = 8;
            if (systemContentBlocks.length > MAX_SYS_BLOCKS) {
                // Keep first 4 (lang instruction + agent core) and last 4 (dynamic/context rules)
                const head = systemContentBlocks.slice(0, 4);
                const tail = systemContentBlocks.slice(-4);
                const middleText = systemContentBlocks
                    .slice(4, -4)
                    .map(b => b.text)
                    .filter(Boolean)
                    .join('\n\n---\n\n');
                if (middleText) {
                    systemContentBlocks.length = 0;
                    systemContentBlocks.push(...head);
                    systemContentBlocks.push({ type: 'text', text: middleText });
                    systemContentBlocks.push(...tail);
                }
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
            // History — semantic context filtering (Step 5) or time window fallback
            const historyMsgs = [];
            // 🔧 Fix TOKEN + GATE: 语义过滤激活门槛 = queryContextLength（默认 5）
            let semanticFiltered = false;
            if (isSemanticEnabled() && sc.features.semanticFilter && session.messages.length > sc.queryContextLength) {
                try {
                    const provider = await getEmbeddingProvider(sc.embeddingModel);
                    if (provider) {
                        // 构建语义消息列表（带 index）
                        const semanticMsgs = session.messages
                            .map((m, i) => ({
                            role: m.role,
                            content: m.content,
                            index: i,
                        }))
                            .filter(m => m.role !== 'system');
                        // 🔧 Fix QUERY: 用最近 N 条消息拼接做查询源（N = queryContextLength）
                        const recentForQuery = semanticMsgs.slice(-sc.queryContextLength);
                        const queryText = recentForQuery.map(m => m.content.slice(0, 500)).join('\n---\n');
                        const userEmbedding = await provider.embed(queryText);
                        const simThreshold = sc.similarityThresholdPercent / 100;
                        const filtered = await assembleSemanticContext(userInput, semanticMsgs, {
                            maxTokens: maxContextTokens,
                            similarityThreshold: simThreshold,
                            provider,
                            userEmbedding,
                            model: modelId,
                        });
                        // 将语义结果转回历史消息格式
                        for (const sm of filtered) {
                            const orig = session.messages[sm.index];
                            if (orig) {
                                const hm = {
                                    role: orig.role,
                                    content: orig.content,
                                    timestamp: orig.timestamp,
                                };
                                if (orig.tool_calls)
                                    hm.tool_calls = orig.tool_calls;
                                historyMsgs.push(hm);
                            }
                        }
                        semanticFiltered = true;
                    }
                }
                catch (embedErr) {
                    console.warn(`[AgentRunner] Semantic filtering failed: ${embedErr.message}, falling back to time window`);
                    // Fall through to time window below
                }
            }
            // 纯时间窗口回退（基于 token 预算）
            if (!semanticFiltered) {
                let used = 0;
                for (let i = session.messages.length - 1; i >= 0; i--) {
                    const msg = session.messages[i];
                    if (msg.role === 'system')
                        continue;
                    // 🔧 TOKEN: 去掉 [Tool Result: 前缀的噪声字符再计数
                    const displayContent = msg.content.replace(/^\[Tool Result[^\]]*\]:?\s*/i, '');
                    const t = countTokens(modelId, displayContent);
                    if (used + t > timeWindowTokens)
                        break;
                    const hm = {
                        role: msg.role, content: msg.content, timestamp: msg.timestamp,
                    };
                    if (msg.tool_calls)
                        hm.tool_calls = msg.tool_calls;
                    historyMsgs.unshift(hm);
                    used += t;
                }
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
                            // Respond with approval and set shutdown flag
                            // CHAT-2: use flag instead of early return so the outer loop
                            // finishes normally through its main exit path (finally cleanup, etc.)
                            const { sendMessage } = await import('../teams/mailbox.js');
                            sendMessage(teamName, msg.from, agentName, 'approved', 'shutdown_response', 'Shutdown approved');
                            if (!abortController.signal.aborted) {
                                abortController.abort();
                            }
                            clearAgentLLMBridge();
                            shutdownRequested = true;
                            finalResponse = 'Shutdown requested by teammate';
                            break; // exit the mailbox polling loop, not the main loop
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
                    let accumulatedText = '';
                    for await (const event of streamGen) {
                        if (event.type === 'thinking') {
                            if (config.onThinking)
                                config.onThinking(event.thinking || '');
                        }
                        else if (event.type === 'token') {
                            // event.text from callLLMStream is the FULL accumulated text so far
                            // (not a delta) — assign, not accumulate, to avoid double-joining.
                            accumulatedText = event.text || '';
                            onToken(accumulatedText);
                        }
                        else if (event.type === 'done') {
                            streamed = event.response;
                        }
                        else if (event.type === 'error') {
                            // S03: Preserve HTTP status from error message
                            const errMsg = event.error || 'Stream error';
                            const statusMatch = errMsg.match(/API 错误 (\d+)/);
                            const streamStatus = statusMatch ? parseInt(statusMatch[1], 10) : 0;
                            throw new LlmError(errMsg, streamStatus, providerId);
                        }
                    }
                    if (!streamed) {
                        // CHAT-1: stream ended without done event — clear partial tokens
                        // from frontend before falling back to non-streaming to avoid
                        // UX glitch where old partial text overlaps with the new response.
                        if (accumulatedText && onToken)
                            onToken('');
                        throw new LlmError('Stream ended without done event', 0, providerId);
                    }
                    response = streamed;
                    streamedResponse = streamed;
                    accumulatedResponseText = accumulatedText; // capture turn 1 streaming text
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
            // Accumulate text across ALL turns (not replace) so Turn 1's long streaming text
            // isn't overwritten by Turn 2+'s shorter tool-loop responses.
            if (!streamedResponse && onToken && response.content) {
                accumulatedResponseText += (accumulatedResponseText ? '\n\n' : '') + response.content;
                onToken(accumulatedResponseText);
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
                        durationMs: Date.now() - startTime,
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
            // Track accumulated response for finalResult (includes text from all turns)
            if (response.content && response.content.trim()) {
                finalResponse = accumulatedResponseText || response.content;
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
                // 🔧 Bug Fix #2: 摘要 tool_call 助理消息
                summarizeMessageAsync({ role: 'assistant', content: response.content }, session.id, session.messages.length - 1);
                onTurn?.(turn, response.content, toolCalls);
                let firstApproval = null;
                // ── Tool Execution Queue ──
                // Phase 1: all read-only tools execute in parallel (Read/Grep/Glob/LSP/etc.)
                // Phase 2: write tools execute sequentially with tick yields between each
                // Results maintain LLM-intended ordering for correct tool_result sequencing.
                resetToolQueue();
                // Wire queue progress → agent config callback (Web UI SSE)
                const unsubProgress = onToolProgress
                    ? subscribeToolProgress(onToolProgress)
                    : null;
                try {
                    const enqueuedTools = toolCalls.map(tc => ({
                        name: tc.name,
                        input: tc.input,
                    }));
                    const execResults = await executeToolBatch(enqueuedTools, toolContext);
                    for (const exec of execResults) {
                        const tc = exec;
                        const result = exec.result;
                        onToolUse?.(tc.name, tc.input, { content: result.content, isError: !!result.isError });
                        recordToolCall(session.id); // Session Memory (M7)
                        addMessage(session, 'user', `[Tool Result: ${tc.name}]\n${result.content}`);
                        touchTool(tc.name); // update LRU timestamp — keep frequently-used tools active
                        toolCallsMade++;
                        // Feature 1 (P5): AskUserQuestion
                        if (tc.name === 'AskUserQuestion' && toolContext.__needsUserInput) {
                            console.warn('[AgentRunner] AskUserQuestion triggered — pausing for user input.');
                            logDiagnostic('WARN', 'agent-runner', 'AskUserQuestion triggered', {
                                sessionId: session.id,
                                questions: toolContext.__needsUserInput?.questions?.length,
                            });
                            const pending = toolContext.__needsUserInput;
                            delete toolContext.__needsUserInput;
                            setPendingUserQuestion(true, session.id);
                            clearAgentLLMBridge();
                            return {
                                finalResponse: response.content,
                                turnsUsed: turn,
                                toolCallsMade,
                                durationMs: Date.now() - startTime,
                                needsUserInput: pending,
                            };
                        }
                        // Permission gate — collect but defer
                        if (result.needsApproval && !firstApproval) {
                            firstApproval = {
                                toolName: tc.name,
                                toolCallId: result.toolCallId || '',
                                input: tc.input,
                                message: result.content,
                            };
                        }
                    }
                }
                finally {
                    if (typeof unsubProgress === 'function')
                        unsubProgress();
                }
                // After processing all tools: if we found a permission gate (and no AskUserQuestion
                // caused an early return), pause for user approval now.
                if (firstApproval) {
                    clearAgentLLMBridge();
                    return {
                        finalResponse: `Awaiting permission approval for ${firstApproval.toolName}`,
                        turnsUsed: turn,
                        toolCallsMade,
                        durationMs: Date.now() - startTime,
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
            // Also catch short responses that end mid-sentence (model stopped without token limit hit)
            const shortAndAbrupt = endsAbruptly && content.length < 500;
            // Diminishing returns: after 3+ continues, if delta < 500 tokens → stop
            const deltaSinceLast = completionTokens - lastCompletionTokens;
            const isDiminishing = consecutiveTruncations >= 3 &&
                deltaSinceLast < 500 &&
                lastCompletionTokens > 0;
            // Cap short-abrupt continues at 3 (not 5) — if model keeps giving tiny answers, stop
            const shortAbruptExhausted = shortAndAbrupt && !truncatedByTokenLimit && consecutiveTruncations >= 3;
            if ((truncatedByTokenLimit || shortAndAbrupt) &&
                endsAbruptly &&
                !isDiminishing &&
                !shortAbruptExhausted &&
                consecutiveTruncations < 5) {
                consecutiveTruncations++;
                lastCompletionTokens = completionTokens;
                // S06: escalate maxTokens on first truncation (mirrors Claude Code max_output_tokens_escalate)
                if (truncatedByTokenLimit && consecutiveTruncations === 1 && currentMaxTokens < MAX_OUTPUT_ESCALATED) {
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
                // S06: subsequent truncations or short-abrupt → nudge to continue
                const nudge = truncatedByTokenLimit
                    ? `Stopped at ${pct}% of token limit (${completionTokens.toLocaleString()} / ${outputMaxTokens.toLocaleString()}). Keep working — do not summarize.`
                    : `Your response appears truncated. Continue from where you left off.`;
                addMessage(session, 'assistant', content);
                addMessage(session, 'user', nudge);
                session.lastAssistantTimestamp = new Date().toISOString();
                onTurn?.(turn, content, undefined);
                onError?.(`Output truncated${shortAndAbrupt ? ' (short, no token limit hit)' : ` at ${completionTokens} tokens`}, auto-continuing (${consecutiveTruncations}/5)...`);
                // S02: checkpoint on truncation continue
                if (consecutiveTruncations % 2 === 0) {
                    saveCheckpoint(session, turn);
                }
                continue;
            }
            // Natural end — final response
            addMessage(session, 'assistant', content);
            session.lastAssistantTimestamp = new Date().toISOString();
            // 🔧 Bug Fix #2: 摘要最终助理回复
            summarizeMessageAsync({ role: 'assistant', content }, session.id, session.messages.length - 1);
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
            // ── Session Memory extraction (B+C+E: regex → local Qwen → online Flash) ──
            if (shouldExtractMemory(session.id, session.messages, querySource, autoCompactEnabled)) {
                markExtractionStarted(session.id);
                // Fire-and-forget: resolve mode config, then extract in background
                resolveSideQueryConfig(config.memorySummaryMode ?? 'regex', rc).then((sideConfig) => {
                    return extractSessionMemoryViaMode([...session.messages], session.id, projectRoot, sideConfig);
                }).catch(() => {
                    // Non-blocking: extraction failure silently ignored
                });
            }
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
        return { finalResponse, turnsUsed: turn, toolCallsMade, durationMs: Date.now() - startTime, error: msg };
    }
    finally {
        clearAgentLLMBridge();
    }
    // S02: final save on normal completion
    try {
        await save(session);
    }
    catch (err) {
        console.warn(`[AgentRunner] Session save failed: ${err.message}`);
    }
    logDiagnostic('INFO', 'agent-runner', 'runAgent returning finalResponse', {
        finalResponseLen: finalResponse?.length ?? 0,
        finalResponseStart: finalResponse.slice(0, 200),
        turnsUsed: turn,
        toolCallsMade,
    });
    return { finalResponse, turnsUsed: turn, toolCallsMade, durationMs: Date.now() - startTime };
}
//# sourceMappingURL=agent-runner.js.map