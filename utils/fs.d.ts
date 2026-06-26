/**
 * File System Utilities
 *
 * Shared helpers for safe file/directory operations used across core and generators.
 */
/** Ensure a directory exists (recursive mkdir) */
export declare function ensureDir(dir: string): void;
/** Ensure the parent directory of a file path exists */
export declare function ensureParentDir(filePath: string): void;
/** Safely read a file; returns null if it doesn't exist */
export declare function readFileSafe(filePath: string): string | null;
/** Write a file, creating parent directories automatically */
export declare function writeFileSafe(filePath: string, content: string): void;
/** Recursively list all files with an optional extension filter */
export declare function listFilesRecursive(dir: string, ext?: string): string[];
/** Safely remove a file or directory (recursive) */
export declare function removeSafe(targetPath: string): void;
/** Count files matching an extension in a directory (non-recursive) */
export declare function countFiles(dir: string, ext: string): number;
//# sourceMappingURL=fs.d.ts.map