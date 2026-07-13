/**
 * Memory Ranking — usage-based memory sorting and cold detection.
 *
 * Uses a JSON file (or SQLite in future) to track hit counts and
 * last-hit timestamps for memory files. Ranks memories by:
 *   score = 0.6 * log2(hits+1) + 0.4 * max(0, 1 - ageDays/180)
 *
 * Three-tier degradation:
 *   Level 1: Stats file available → weighted ranking
 *   Level 2: Stats corrupted → rebuild from frontmatter (future: SQLite)
 *   Level 3: No stats → pure mtime sort
 *
 * References:
 *   Idea/tutrue/memory-system-design.md §3.0-§3.6
 */
export interface MemoryStats {
    path: string;
    hits: number;
    lastHit: number;
    createdAt: number;
    lastWrite: number;
}
interface RankingDb {
    [path: string]: Omit<MemoryStats, 'path'>;
}
/**
 * Rank memory files by usage frequency and recency.
 */
export declare function rankByUsage(files: Array<{
    filename: string;
    path: string;
    mtimeMs: number;
}>, memoryDir: string): Array<{
    filename: string;
    path: string;
    score: number;
}>;
/**
 * Record a hit on a memory file (increment usage counter).
 */
export declare function recordHits(fileNames: string[], memoryDir: string): void;
/**
 * Detect cold memories (0 hits, last hit > threshold days ago).
 */
export declare function detectColdMemories(memoryDir: string, thresholdDays?: number): string[];
/**
 * Get stats for a specific memory file.
 */
export declare function getMemoryStats(filename: string, memoryDir: string): MemoryStats | undefined;
/**
 * Rebuild stats from memory file frontmatter (degradation recovery).
 * Scans frontmatter for hits/last_hit fields.
 */
export declare function rebuildFromFrontmatter(fileNames: string[], memoryDir: string): RankingDb;
/**
 * Initialize ranking database.
 */
export declare function initRankingDb(memoryDir: string): void;
export {};
//# sourceMappingURL=memory-ranking.d.ts.map