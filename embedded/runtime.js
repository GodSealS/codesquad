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
export const isBunCompiled = !import.meta.url.startsWith('file://');
/**
 * Read a relative file path from embedded data.
 * @returns File content as string, or null if not found
 */
export function readEmbeddedFile(relativePath) {
    // Lazy-load to avoid circular dependency at module init time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EMBEDDED_FILES } = require('./aicore-data.js');
    return EMBEDDED_FILES[relativePath] ?? null;
}
/**
 * List directory entries from embedded data (readdir semantics).
 * @returns Array of entry names, or empty array if dir not found
 */
export function readEmbeddedDir(relativeDir) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EMBEDDED_DIRS } = require('./aicore-data.js');
    return EMBEDDED_DIRS[relativeDir] ?? [];
}
/**
 * Check if a path exists in embedded data.
 */
export function existsEmbeddedPath(relativePath) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EMBEDDED_FILE_SET } = require('./aicore-data.js');
    return EMBEDDED_FILE_SET.has(relativePath);
}
/**
 * Get embedded generation statistics.
 */
export function getEmbeddedStats() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { EMBEDDED_STATS } = require('./aicore-data.js');
        return EMBEDDED_STATS;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=runtime.js.map