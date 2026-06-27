/**
 * File read state cache — enforces Read-then-Write pattern.
 *
 * Every FileReadTool call records the file content + mtime + hash.
 * FileWriteTool.checkPermissions() checks wasFileRead().
 * FileEditTool.validateInput() checks isFileStale().
 *
 * Phase 1.1
 */
import type { ReadFileEntry, ReadFileStateCache } from './types.js';
export declare class InMemoryReadFileState implements ReadFileStateCache {
    private store;
    get(filePath: string): ReadFileEntry | undefined;
    set(filePath: string, entry: ReadFileEntry): void;
    has(filePath: string): boolean;
    clear(): void;
}
/**
 * Record a file read into the cache.
 */
export declare function recordFileRead(cache: ReadFileStateCache, filePath: string, content: string): void;
/**
 * Check if a file has been read in the current session.
 */
export declare function wasFileRead(cache: ReadFileStateCache, filePath: string): boolean;
/**
 * Check if a file has been modified externally since it was last read.
 * Returns { stale: true, detail } if stale.
 */
export declare function checkFileStaleness(cache: ReadFileStateCache, filePath: string, newContent?: string): {
    stale: boolean;
    detail?: string;
};
/** Get the session-level read file cache (lazy init). */
export declare function getSessionCache(): ReadFileStateCache;
/** Reset the session-level cache (called on /clear or new session). */
export declare function clearSessionCache(): void;
//# sourceMappingURL=file-state.d.ts.map