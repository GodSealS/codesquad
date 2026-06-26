/**
 * Auto-compact trigger — monitors token usage and triggers compaction.
 *
 * References:
 *   Claude Code src/services/compact/autoCompact.ts
 *
 * Phase 4.1
 */
import type { Message, Session } from '../chat/session.js';
import { type CompactionResult } from './compact.js';
import type { TaskResult } from '../core/task-result.js';
/**
 * Check if auto-compaction should be triggered.
 * Called before each sendToAgent() call.
 */
export declare function shouldAutoCompact(messages: Message[], model: string, sessionId?: string): {
    should: boolean;
    tokenUsage: number;
    thresholdTokens: number;
    percentUsed: number;
};
/**
 * Check and optionally auto-compact.
 * Returns compact result if compaction was performed, null otherwise.
 */
export declare function autoCompact(messages: Message[], session: Session, model: string, callLLM: (input: {
    model: string;
    messages: Array<{
        role: string;
        content: string;
    }>;
    maxTokens: number;
}) => Promise<string>, onWarning?: (pct: number) => void): Promise<CompactionResult | null>;
/**
 * P3: TaskResult-wrapped version of autoCompact.
 * Returns structured result instead of throwing on failure.
 */
export declare function autoCompactWithResult(messages: Message[], session: Session, model: string, callLLM: (input: {
    model: string;
    messages: Array<{
        role: string;
        content: string;
    }>;
    maxTokens: number;
}) => Promise<string>, onWarning?: (pct: number) => void): Promise<TaskResult<CompactionResult | null>>;
/** Increment turn counter. Call at the start of each sendToAgent(). */
export declare function incrementTurn(sessionId?: string): boolean;
/** Reset compaction tracking (on /new or /clear). */
export declare function resetCompactTracking(sessionId?: string): boolean;
declare function getContextWindow(model: string): number;
export { getContextWindow };
//# sourceMappingURL=auto-compact.d.ts.map