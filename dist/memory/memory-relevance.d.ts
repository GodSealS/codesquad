/**
 * Memory Relevance — finds the most relevant memory files for a query.
 *
 * Three-phase selection:
 *   Phase 1: Keyword/BM25 pre-filtering (Top-20, no LLM)
 *   Phase 2: Embedding-based semantic filter (cosine ≥ threshold) or keyword threshold fallback
 *   Phase 3: selectTopMemories — combined score + mtime sort → Top-5
 *
 * Turn-level caching prevents redundant scans within the same conversation turn.
 *
 * References:
 *   Claude Code src/memdir/findRelevantMemories.ts
 *   Idea/tutrue/memory-system-design.md §2.3.4
 */
import type { EmbeddingProvider } from '../embedding/types.js';
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
    /** Relevance score from keyword matching (un-normalized; can exceed 1). */
    score?: number;
}
/** Advance the turn counter (called at the start of each conversation turn). */
export declare function advanceMemoryTurn(): void;
/** Clear the turn-level cache (for testing / session reset). */
export declare function clearTurnCache(): void;
/**
 * Find the most relevant memory files for a given query.
 *
 * Uses embedding-based semantic matching when a provider is available;
 * falls back to keyword matching with a minimum score threshold.
 * Memories are NOT injected unless they genuinely match the current query.
 *
 * @param query - User query / conversation context
 * @param memoryDir - Path to the memory directory
 * @param _signal - AbortSignal for cancellation (unused in MVP)
 * @param _recentTools - Recently used tools for filtering (unused in MVP)
 * @param alreadySurfaced - Set of already-surfaced filenames to exclude
 * @param provider - Optional EmbeddingProvider for semantic matching
 */
export declare function findRelevantMemories(query: string, memoryDir: string, _signal?: AbortSignal, _recentTools?: string[], alreadySurfaced?: Set<string>, provider?: EmbeddingProvider | null): Promise<RelevantMemory[]>;
//# sourceMappingURL=memory-relevance.d.ts.map