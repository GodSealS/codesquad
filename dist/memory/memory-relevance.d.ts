/**
 * Memory Relevance — finds the most relevant memory files for a query.
 *
 * Two-phase selection:
 *   Phase 1: Keyword/BM25 pre-filtering (Top-20, no LLM)
 *   Phase 2: LLM refinement (Top-5, sideQuery with light model)
 *
 * Turn-level caching prevents redundant scans within the same conversation turn.
 *
 * References:
 *   Claude Code src/memdir/findRelevantMemories.ts
 *   Idea/tutrue/memory-system-design.md §2.3.4
 */
export interface RelevantMemory {
    /** Relative filename of the memory file. */
    filename: string;
    /** Full file path. */
    path: string;
    /** Extracted frontmatter name. */
    name: string;
    /** Extracted frontmatter description. */
    description: string;
    /** Memory type. */
    type?: string;
    /** Formatted content for context injection. */
    content: string;
    /** Staleness note (if applicable). */
    stalenessNote: string;
    /** Relevance score (0-1) from LLM selection. */
    score?: number;
}
/** Advance the turn counter (called at the start of each conversation turn). */
export declare function advanceMemoryTurn(): void;
/**
 * Find the most relevant memory files for a given query.
 *
 * @param query - User query / conversation context
 * @param memoryDir - Path to the memory directory
 * @param _signal - AbortSignal for cancellation (unused in MVP)
 * @param _recentTools - Recently used tools for filtering (unused in MVP)
 * @param alreadySurfaced - Set of already-surfaced filenames to exclude
 */
export declare function findRelevantMemories(query: string, memoryDir: string, _signal?: AbortSignal, _recentTools?: string[], alreadySurfaced?: Set<string>): RelevantMemory[];
//# sourceMappingURL=memory-relevance.d.ts.map