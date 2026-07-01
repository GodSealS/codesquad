/**
 * Cross-chat memory summarizer.
 *
 * When a new session is created, extracts key context from recent
 * historical sessions and formats it as an injected system message.
 * Mitigates the "new chat loses history" problem for LLM context windows.
 *
 * Phase 8.2-8.3. Step 7: semantic cross-session retrieval.
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
 *
 * If `userInput` is provided and semantic context is enabled, uses
 * embedding-based cross-session retrieval to find semantically relevant
 * messages from past sessions. Otherwise falls back to time-based recency.
 *
 * Excludes the session identified by `excludeId` (the currently active session).
 *
 * @param limit Maximum number of sessions to include
 * @param excludeId Current session ID to exclude
 * @param userInput Optional user input for semantic matching
 * @returns HistorySummary or null if no relevant sessions found
 */
export declare function summarizeHistory(limit: number, excludeId?: string, userInput?: string): Promise<HistorySummary | null>;
/**
 * Format a HistorySummary as a Markdown text block suitable for
 * injection into the system prompt or context.
 */
export declare function formatHistorySummary(summary: HistorySummary): string;
//# sourceMappingURL=memory-summarizer.d.ts.map