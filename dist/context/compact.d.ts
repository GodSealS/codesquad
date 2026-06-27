/**
 * Compact — LLM-powered conversation summarization.
 *
 * Replaces the v1 hard-truncation in budget.ts with intelligent LLM summarization.
 *
 * References:
 *   Claude Code src/services/compact/compact.ts (1706 lines)
 *
 * Algorithm (7 phases):
 *   1. Pre-check token count
 *   2. Execute PreCompact hooks
 *   3. Build compact prompt (9 chapter summary)
 *   4. Call LLM to generate summary
 *   5. Build compacted messages (boundary + summary + attachments)
 *   6. Execute PostCompact hooks
 *   7. Restore key files
 *
 * Phase 4.0
 */
import type { Message, Session } from '../chat/session.js';
export interface CompactionResult {
    /** System message marking the compaction boundary. */
    boundaryMessage: Message;
    /** LLM-generated summary user message. */
    summaryMessage: Message;
    /** Pre-compact token count. */
    preCompactTokenCount: number;
    /** Post-compact estimated token count. */
    postCompactTokenCount: number;
    /** Number of messages that were compacted. */
    compactedMessageCount: number;
    /** Custom instructions injected by PreCompact hooks. */
    customInstructions?: string;
}
export interface CompactOptions {
    /** Model to use for the compaction LLM call. */
    model: string;
    /** Maximum tokens for the summary output. */
    maxOutputTokens?: number;
    /** Custom instructions to include in the compaction prompt. */
    customInstructions?: string;
    /** Whether to suppress follow-up questions. */
    suppressFollowUp?: boolean;
}
/**
 * Compact a conversation into a concise summary.
 *
 * @param messages  All conversation messages.
 * @param session   Current session for context.
 * @param options   Compaction options.
 * @param callLLM   LLM caller function (injected for testability).
 */
export declare function compactConversation(messages: Message[], session: Session, options: CompactOptions, callLLM: (input: {
    model: string;
    messages: Array<{
        role: string;
        content: string;
    }>;
    maxTokens: number;
}) => Promise<string>): Promise<CompactionResult>;
/**
 * Replace old messages with compacted ones.
 * Keeps recent N messages + adds boundary + summary.
 */
export declare function applyCompaction(messages: Message[], result: CompactionResult, keepRecent?: number): Message[];
//# sourceMappingURL=compact.d.ts.map