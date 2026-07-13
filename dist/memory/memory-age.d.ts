/**
 * Memory age/staleness utilities.
 *
 * Injects freshness warnings when old memories are retrieved,
 * reminding LLMs that stored observations may be stale.
 *
 * References:
 *   Claude Code src/memdir/memoryAge.ts
 *   Idea/tutrue/memory-system-design.md §2.3.6
 */
/** Calculate age of a memory in days. */
export declare function memoryAgeDays(mtimeMs: number): number;
/** Human-readable age string (e.g., "today", "yesterday", "47 days ago"). */
export declare function memoryAge(mtimeMs: number): string;
/** Returns staleness warning text when memory is older than 1 day. */
export declare function memoryFreshnessText(mtimeMs: number): string;
/** Wrap freshness warning in <system-reminder> tag for context injection. */
export declare function memoryFreshnessNote(mtimeMs: number): string;
//# sourceMappingURL=memory-age.d.ts.map