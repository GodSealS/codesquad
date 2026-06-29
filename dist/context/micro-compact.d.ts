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
import type { Session } from '../chat/session.js';
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
export declare function microCompact(messages: Array<{
    role: string;
    content: string;
}>): Array<{
    role: string;
    content: string;
}>;
/**
 * S09: micro-compact with time-based trigger.
 *
 * If the gap since the last assistant message exceeds the threshold,
 * force-clear ALL compactable results (keeping only the most recent 1)
 * because the server-side prompt cache has expired.
 */
export declare function microCompactWithSession(messages: Array<{
    role: string;
    content: string;
}>, session: Session): Array<{
    role: string;
    content: string;
}>;
/**
 * Estimate the token savings from micro-compacting a message array.
 * Returns estimated tokens saved (approximate).
 */
export declare function estimateMicroCompactSavings(messages: Array<{
    role: string;
    content: string;
}>): {
    savedChars: number;
    estimatedSavedTokens: number;
};
/**
 * Apply micro-compact to conversation history before sending to LLM.
 * Wraps microCompact() with safe defaults.
 *
 * @param messages - History messages from session
 * @param maxRecent - Max recent messages to preserve unconditionally (default: 20)
 */
export declare function preCompactHistory(messages: Array<{
    role: string;
    content: string;
    timestamp?: string;
}>, maxRecent?: number): Array<{
    role: string;
    content: string;
    timestamp?: string;
}>;
//# sourceMappingURL=micro-compact.d.ts.map