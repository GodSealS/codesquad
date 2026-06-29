/**
 * Micro-Compact — lightweight compaction that strips old tool results.
 *
 * Unlike full Compact (which calls LLM to summarize), Micro-Compact is a pure
 * text transformation that runs before every LLM API call with sub-millisecond
 * overhead. It replaces old tool_result content with a stub while keeping:
 * - Recent N tool interactions intact (so LLM has context for recovery)
 * - All non-tool messages intact (user messages, assistant text)
 * - Tool call parameters intact (LLM needs to know what was called)
 *
 * References:
 *   Claude Code src/services/compact/microCompact.ts
 *
 * Feature 5 — P4 Micro-Compact
 * S09 — Defensive Execution: tool-type filtering + time-based trigger
 */
// ── Constants ──
/** Number of most recent tool interactions to keep fully intact. */
const RECENT_TOOL_INTERACTIONS = 5;
/** Minimum retained on time-based force-clear (always keep at least 1). */
const TIME_BASED_MIN_KEEP = 1;
/** Time gap threshold: if last assistant message > this, force-clear old results. */
const GAP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
/** Stub text for compacted tool results. */
const TOOL_RESULT_STUB = '[Previous tool output omitted by micro-compact]';
/**
 * S09: Tools eligible for micro-compaction.
 * Heavy I/O tools whose results are large and become stale quickly.
 * Excludes: AgentTool, SkillTool, TaskCreateTool, AskUserQuestionTool — these
 * contain structured context that the LLM needs to understand subtask progress.
 */
const COMPACTABLE_TOOLS = new Set([
    'BashTool', 'Bash', 'Read', 'Grep', 'Glob',
    'WebSearch', 'WebFetch', 'FileEdit', 'FileWrite',
    'LSPTool',
]);
// ── Main ──
/**
 * Apply micro-compaction to a conversation history.
 *
 * Strategy:
 * 1. Identify tool-use → tool-result pairs (S09: only COMPACTABLE_TOOLS)
 * 2. Keep the most recent RECENT_TOOL_INTERACTIONS pairs fully intact
 * 3. For older pairs: replace tool_result content with a short stub
 * 4. Non-tool messages are left untouched
 *
 * @param messages - Conversation messages (excluding system prompts)
 * @returns Modified messages (same array, mutated in place)
 * @warning Callers who need the original messages intact should pass `messages.slice()`.
 */
export function microCompact(messages) {
    if (messages.length < 4)
        return messages;
    const pairs = findToolPairs(messages);
    if (pairs.length <= RECENT_TOOL_INTERACTIONS)
        return messages;
    return applyCompaction(messages, pairs, RECENT_TOOL_INTERACTIONS);
}
/**
 * S09: micro-compact with time-based trigger.
 *
 * If the gap since the last assistant message exceeds the threshold,
 * force-clear ALL compactable results (keeping only the most recent 1)
 * because the server-side prompt cache has expired.
 */
export function microCompactWithSession(messages, session) {
    if (messages.length < 4)
        return messages;
    // S09: time-based trigger
    const shouldForceClear = checkTimeBasedTrigger(session);
    const keepCount = shouldForceClear ? TIME_BASED_MIN_KEEP : RECENT_TOOL_INTERACTIONS;
    const pairs = findToolPairs(messages);
    if (pairs.length <= keepCount)
        return messages;
    return applyCompaction(messages, pairs, keepCount);
}
// ── Internal ──
function applyCompaction(messages, pairs, keepCount) {
    const recentPairs = pairs.slice(-keepCount);
    const recentIndices = new Set();
    for (const p of recentPairs) {
        recentIndices.add(p.assistantIdx);
        recentIndices.add(p.resultIdx);
    }
    for (const pair of pairs.slice(0, -keepCount)) {
        const resultMsg = messages[pair.resultIdx];
        if (resultMsg && !recentIndices.has(pair.resultIdx)) {
            resultMsg.content = TOOL_RESULT_STUB;
        }
    }
    return messages;
}
/** S09: check if the prompt cache has likely expired (gap > threshold). */
function checkTimeBasedTrigger(session) {
    if (!session.lastAssistantTimestamp)
        return false;
    const lastMs = new Date(session.lastAssistantTimestamp).getTime();
    if (!Number.isFinite(lastMs))
        return false;
    return (Date.now() - lastMs) > GAP_THRESHOLD_MS;
}
/**
 * Estimate the token savings from micro-compacting a message array.
 * Returns estimated tokens saved (approximate).
 */
export function estimateMicroCompactSavings(messages) {
    const pairs = findToolPairs(messages);
    if (pairs.length <= RECENT_TOOL_INTERACTIONS) {
        return { savedChars: 0, estimatedSavedTokens: 0 };
    }
    let savedChars = 0;
    for (const pair of pairs.slice(0, -RECENT_TOOL_INTERACTIONS)) {
        const resultMsg = messages[pair.resultIdx];
        if (resultMsg && resultMsg.content.length > TOOL_RESULT_STUB.length) {
            savedChars += resultMsg.content.length - TOOL_RESULT_STUB.length;
        }
    }
    // Rough estimate: 4 chars ≈ 1 token
    return {
        savedChars,
        estimatedSavedTokens: Math.round(savedChars / 4),
    };
}
// ── Tool Pair Detection ──
/**
 * Find tool-use → tool-result pairs in the message history.
 *
 * Detection patterns:
 * - XML: assistant message contains <tool-call> followed by message with "[Tool: ...]"
 * - Native: assistant message has tool_calls metadata
 * - Tool results: usually [Tool: ToolName] prefix
 */
function findToolPairs(messages) {
    const pairs = [];
    for (let i = 0; i < messages.length - 1; i++) {
        const msg = messages[i];
        const nextMsg = messages[i + 1];
        if (!msg || !nextMsg)
            continue;
        // S09: only compact COMPACTABLE_TOOLS (heavy I/O tools).
        // AgentTool, SkillTool results are preserved — they contain subtask context.
        const toolNames = extractCompactableToolNames(msg);
        if (toolNames.length === 0)
            continue;
        // Next message should be a tool result
        const isToolResult = nextMsg.content.startsWith('[Tool:') ||
            nextMsg.content.startsWith('[Tool Result:') ||
            nextMsg.role === 'tool_result' ||
            (nextMsg.role === 'system' && nextMsg.content.includes('[Tool:'));
        if (isToolResult) {
            pairs.push({ assistantIdx: i, resultIdx: i + 1 });
        }
    }
    return pairs;
}
/** S09: extract tool names from assistant content that match COMPACTABLE_TOOLS. */
function extractCompactableToolNames(msg) {
    if (msg.role !== 'assistant')
        return [];
    const names = new Set();
    // XML pattern: <tool-call name="ToolName">
    const xmlRe = /<tool-call\s+name="([^"]+)"/gi;
    let m;
    while ((m = xmlRe.exec(msg.content)) !== null) {
        if (COMPACTABLE_TOOLS.has(m[1]))
            names.add(m[1]);
    }
    // Native tool_calls metadata
    if (Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
            const name = tc.name || tc.function?.name;
            if (name && COMPACTABLE_TOOLS.has(name))
                names.add(name);
        }
    }
    return [...names];
}
// ── Integration helpers ──
/**
 * Apply micro-compact to conversation history before sending to LLM.
 * Wraps microCompact() with safe defaults.
 *
 * @param messages - History messages from session
 * @param maxRecent - Max recent messages to preserve unconditionally (default: 20)
 */
export function preCompactHistory(messages, maxRecent = 20) {
    if (messages.length <= maxRecent)
        return messages;
    // Keep most recent messages intact, only compact older ones
    const recent = messages.slice(-maxRecent);
    const older = messages.slice(0, -maxRecent);
    // Compact older messages
    microCompact(older);
    return [...older, ...recent];
}
//# sourceMappingURL=micro-compact.js.map