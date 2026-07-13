/**
 * Workspace memory file system — MEMORY.md index + daily logs.
 *
 * References:
 *   Claude Code src/memdir/memdir.ts
 *
 * Structure:
 *   .codesquad/memory/
 *   ├── MEMORY.md           — index file (one pointer per line)
 *   ├── YYYY-MM-DD.md       — daily log (append-only)
 *   └── [topic].md          — standalone memory files
 *
 * Phase 5.2
 */
/**
 * Read the MEMORY.md index.
 * Returns an array of { title, file, description } entries.
 */
export declare function readMemoryIndex(): Array<{
    title: string;
    file: string;
    description: string;
}>;
/**
 * Add an entry to the MEMORY.md index.
 */
export declare function addMemoryEntry(title: string, file: string, description: string): void;
/**
 * Check if today's daily log exists.
 */
export declare function dailyLogExists(date?: string): boolean;
/**
 * Read today's daily log.
 */
export declare function readDailyLog(date?: string): string;
/**
 * Append to today's daily log.
 */
export declare function appendDailyLog(content: string, date?: string): void;
/**
 * Write content to a standalone memory file.
 */
export declare function writeMemoryFile(filename: string, content: string): string;
/**
 * Read a standalone memory file.
 */
export declare function readMemoryFile(filename: string): string | null;
/**
 * List all memory files.
 */
export declare function listMemoryFiles(): string[];
/**
 * Distill daily logs older than 30 days into MEMORY.md.
 */
export declare function distillOldLogs(maxAgeDays?: number): number;
/**
 * Truncate memory content if it exceeds capacity limits.
 * Returns the truncated content and a warning message if truncation occurred.
 */
export declare function truncateEntrypointContent(content: string): {
    content: string;
    truncated: boolean;
    warning?: string;
};
/**
 * Ensure memory directory exists (creates if missing).
 */
export declare function ensureMemoryDirExists(): string;
/** Get the memory directory path (creates if missing). */
export declare function getMemoryDir(): string;
//# sourceMappingURL=workspace-memory.d.ts.map