/**
 * runtime — Embedded mode detection and data access API
 *
 * When the CLI is compiled via `bun build --compile`, all AICore content
 * is embedded in the binary as string constants in `aicore-data.ts`.
 * This module detects the runtime mode and provides unified data access.
 */
/**
 * Whether the current process is a Bun-compiled binary.
 *
 * Detection: In a compiled binary, `import.meta.url` does NOT start with
 * `file://`. In tsx/node dev mode, it always does.
 */
export declare const isBunCompiled: boolean;
/**
 * Read a relative file path from embedded data.
 * @returns File content as string, or null if not found
 */
export declare function readEmbeddedFile(relativePath: string): string | null;
/**
 * List directory entries from embedded data (readdir semantics).
 * @returns Array of entry names, or empty array if dir not found
 */
export declare function readEmbeddedDir(relativeDir: string): string[];
/**
 * Check if a path exists in embedded data.
 */
export declare function existsEmbeddedPath(relativePath: string): boolean;
/**
 * Get embedded generation statistics.
 */
export declare function getEmbeddedStats(): {
    totalFiles: number;
    totalDirs: number;
    totalSizeBytes: number;
    generatedAt: string;
} | null;
//# sourceMappingURL=runtime.d.ts.map