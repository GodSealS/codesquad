/**
 * Cross-chat memory summarizer.
 *
 * When a new session is created, extracts key context from recent
 * historical sessions and formats it as an injected system message.
 * Mitigates the "new chat loses history" problem for LLM context windows.
 *
 * Phase 8.2-8.3.
 */
export interface HistorySummary {
    /** ISO 8601 timestamp when this summary was generated. */
    generatedAt: string;
    /** Number of historical sessions included. */
    sessionCount: number;
    /** Per-session extracted summaries. */
    sessions: Array<{
        agent: string;
        name: string;
        updatedAt: string;
        summary: string;
    }>;
}
/**
 * Extract summaries from the most recent N historical sessions.
 * Excludes the session identified by `excludeId` (the currently active session).
 * Each session contributes its last 3 assistant messages (first 200 chars each,
 * truncated at nearest word boundary).
 *
 * Returns null if there are no historical sessions to summarize.
 */
export declare function summarizeHistory(limit: number, excludeId?: string): Promise<HistorySummary | null>;
/**
 * Format a HistorySummary as a Markdown text block suitable for
 * injection into the system prompt or context.
 */
export declare function formatHistorySummary(summary: HistorySummary): string;
//# sourceMappingURL=memory-summarizer.d.ts.map