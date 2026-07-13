/**
 * Memory-Driven Compact — uses session-memory summaries for context compression.
 *
 * Instead of pure token-count truncation, uses the session-memory.md summary
 * extracted by session-memory.ts as a "summary proxy" for earlier conversation.
 * Falls back to plain token truncation when session-memory.md is unavailable.
 *
 * References:
 *   Claude Code src/services/compact/sessionMemoryCompact.ts
 *   Idea/tutrue/memory-system-design.md §2.3.8
 */
import { readSessionMemory } from './session-memory.js';
export const DEFAULT_MEMORY_COMPACT_CONFIG = {
    compactTokenThreshold: 80_000,
    keepRecentMessages: 5,
    maxSummaryTokens: 2000,
};
// ── API ──
/**
 * Build a memory-compacted message array.
 * Uses session-memory summary + recent N messages.
 * Falls back to plain token truncation if no session-memory exists.
 *
 * @param messages - Full message history
 * @param sessionId - Current session ID
 * @param projectRoot - Project root directory
 * @param config - Compact configuration
 * @returns Compacted message array with summary prefix
 */
export function buildMemoryCompactContext(messages, sessionId, projectRoot, config = DEFAULT_MEMORY_COMPACT_CONFIG) {
    if (messages.length <= config.keepRecentMessages)
        return messages;
    const sessionMem = readSessionMemory(sessionId, projectRoot);
    // Keep recent N messages
    const recent = messages.slice(-config.keepRecentMessages);
    if (sessionMem && sessionMem.trim().length > 0) {
        // Build summary prefix as a system message
        const summaryMsg = {
            role: 'user',
            content: [
                '<session_memory_summary>',
                sessionMem.slice(0, config.maxSummaryTokens * 4),
                '</session_memory_summary>',
                '',
                'The above summarizes the earlier part of this conversation.',
                'Continue the conversation with full context awareness.',
            ].join('\n'),
            timestamp: new Date().toISOString(),
        };
        return [summaryMsg, ...recent];
    }
    // Fallback: plain truncation
    return recent;
}
/**
 * Check if memory compact should be triggered.
 */
export function shouldMemoryCompact(totalTokens, config = DEFAULT_MEMORY_COMPACT_CONFIG) {
    return totalTokens >= config.compactTokenThreshold;
}
//# sourceMappingURL=memory-compact.js.map