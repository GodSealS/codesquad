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
 */
// ── Constants ──
/** Number of most recent tool interactions to keep fully intact. */
const RECENT_TOOL_INTERACTIONS = 5;
/** Stub text for compacted tool results. */
const TOOL_RESULT_STUB = '[Previous tool output omitted by micro-compact]';
// ── Main ──
/**
 * Apply micro-compaction to a conversation history.
 *
 * Strategy:
 * 1. Identify tool-use → tool-result pairs
 * 2. Keep the most recent RECENT_TOOL_INTERACTIONS pairs fully intact
 * 3. For older pairs: replace tool_result content with a short stub
 * 4. Non-tool messages are left untouched
 *
 * @param messages - Conversation messages (excluding system prompts)
 * @returns Modified messages (same array, mutated in place)
 */
export function microCompact(messages) {
    if (messages.length < 4)
        return messages; // Too few to compact
    // 1. Find tool pairs: (assistant with tool call → result message)
    const pairs = findToolPairs(messages);
    if (pairs.length <= RECENT_TOOL_INTERACTIONS)
        return messages;
    // 2. Separate recent vs old pairs
    const recentPairs = pairs.slice(-RECENT_TOOL_INTERACTIONS);
    const recentIndices = new Set();
    for (const p of recentPairs) {
        recentIndices.add(p.assistantIdx);
        recentIndices.add(p.resultIdx);
    }
    // 3. Compact old pairs
    for (const pair of pairs.slice(0, -RECENT_TOOL_INTERACTIONS)) {
        const resultMsg = messages[pair.resultIdx];
        if (resultMsg && !recentIndices.has(pair.resultIdx)) {
            resultMsg.content = TOOL_RESULT_STUB;
        }
    }
    return messages;
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
        // Assistant message with tool calls (XML or metadata)
        const hasToolCall = msg.role === 'assistant' &&
            (hasXmlToolCall(msg.content) || hasNativeToolCalls(msg));
        if (!hasToolCall)
            continue;
        // Next message should be a tool result
        // Note: REPL stores results as role='system', agent-runner stores as role='user'
        // Both paths are valid — detect by content prefix or role==='tool_result'
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
function hasXmlToolCall(content) {
    return /<tool-call\s+name="[^"]+"/i.test(content);
}
function hasNativeToolCalls(msg) {
    return Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;
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