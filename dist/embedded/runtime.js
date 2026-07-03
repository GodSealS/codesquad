/**
 * runtime — Embedded mode detection and data access API
 *
 * When the CLI is compiled via `bun build --compile`, all .codesquad content
 * is embedded in the binary as Base64-encoded string constants.
 * This module decodes on read so callers always get plaintext.
 */
import { EMBEDDED_FILES, IS_BASE64_ENCODED, EMBEDDED_DIRS, EMBEDDED_FILE_SET, EMBEDDED_STATS, } from './aicore-data.js';
/**
 * Whether the current process is a Bun-compiled binary.
 *
 * Detection (Bun v1.0):  import.meta.url = "B:\\~BUN\\root\\codesquad.exe" (no file://)
 * Detection (Bun v1.1+): import.meta.url = "file:///B:/~BUN/root/codesquad.exe" (has ~BUN)
 * Detection (dev/tsx):   import.meta.url = "file:///C:/work/codesquad/src/..." (real path)
 */
export const isBunCompiled = !import.meta.url.startsWith('file://') || import.meta.url.includes('~BUN');
/** Decode a Base64-encoded embedded value back to UTF-8 text. */
function decodeEmbedded(encoded) {
    return Buffer.from(encoded, 'base64').toString('utf-8');
}
/**
 * Read a relative file path from embedded data.
 * In PROD mode (IS_BASE64_ENCODED=true), content is Base64-decoded transparently.
 * In DEV mode (IS_BASE64_ENCODED=false), content is already plaintext.
 * @returns File content as string, or null if not found
 */
export function readEmbeddedFile(relativePath) {
    const raw = EMBEDDED_FILES[relativePath];
    if (!raw)
        return null;
    return IS_BASE64_ENCODED ? decodeEmbedded(raw) : raw;
}
/**
 * List directory entries from embedded data (readdir semantics).
 * @returns Array of entry names, or empty array if dir not found
 */
export function readEmbeddedDir(relativeDir) {
    return EMBEDDED_DIRS[relativeDir] ?? [];
}
/**
 * Check if a path exists in embedded data (files or directories).
 */
export function existsEmbeddedPath(relativePath) {
    return EMBEDDED_FILE_SET.has(relativePath) || relativePath in EMBEDDED_DIRS;
}
/**
 * Get embedded generation statistics.
 */
export function getEmbeddedStats() {
    try {
        return EMBEDDED_STATS;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=runtime.js.map