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
import type { Message } from '../chat/session.js';
export interface MemoryCompactConfig {
    compactTokenThreshold: number;
    keepRecentMessages: number;
    maxSummaryTokens: number;
}
export declare const DEFAULT_MEMORY_COMPACT_CONFIG: MemoryCompactConfig;
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
export declare function buildMemoryCompactContext(messages: Message[], sessionId: string, projectRoot: string, config?: MemoryCompactConfig): Message[];
/**
 * Check if memory compact should be triggered.
 */
export declare function shouldMemoryCompact(totalTokens: number, config?: MemoryCompactConfig): boolean;
//# sourceMappingURL=memory-compact.d.ts.map