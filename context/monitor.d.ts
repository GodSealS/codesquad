/**
 * Context usage monitor — tracks token consumption and displays warnings.
 *
 * Phase 4.3
 */
import type { Message } from '../chat/session.js';
export interface ContextStats {
    model: string;
    contextWindow: number;
    totalTokens: number;
    systemTokens: number;
    contextTokens: number;
    historyTokens: number;
    percentUsed: number;
    isWarning: boolean;
    isCritical: boolean;
    canCompact: boolean;
    messageCount: number;
    lastCompaction?: string;
}
export declare function recordCompaction(): void;
export declare function resetCompactionRecord(): void;
/**
 * Calculate context usage statistics.
 */
export declare function calculateContextStats(messages: Message[], model: string): ContextStats;
/**
 * Format context stats for display.
 */
export declare function formatContextStats(stats: ContextStats): string;
//# sourceMappingURL=monitor.d.ts.map