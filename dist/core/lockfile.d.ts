/**
 * lockfile — .codesquad.lock management
 *
 * Phase 7.4: Records generation metadata (version, timestamp, file hashes)
 * to enable diff-based incremental updates and protect user customizations.
 */
export interface FileEntry {
    hash: string;
}
export interface LockFile {
    version: number;
    generated_at: string;
    cli_version: string;
    definitions_version: string;
    files: Record<string, FileEntry>;
}
/**
 * Read an existing lock file.
 */
export declare function readLock(targetPath?: string): LockFile | null;
/**
 * Create or update a lock file with current generation state.
 */
export declare function writeLock(targetPath: string, cliVersion: string, definitionsVersion: string, files: Map<string, string>): void;
/**
 * Check if a file was modified by the user (hash differs from lock).
 * Returns 'unchanged' | 'modified' | 'new' | 'unknown'
 */
export declare function checkFileStatus(lock: LockFile | null, filePath: string, currentContent: string): 'unchanged' | 'modified' | 'new' | 'unknown';
/**
 * Compute the hash for a file's content (useful when writing new lock entries).
 */
export declare function hashContent(content: string): string;
//# sourceMappingURL=lockfile.d.ts.map