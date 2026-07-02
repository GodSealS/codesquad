/**
 * virtual-fs — Unified file system for embedded + on-disk access.
 *
 * In Bun-compiled mode, .codesquad content and config files are baked into the
 * binary.  In Node.js / npm-link mode they live on disk.  This module wraps
 * both sources behind a single API so callers don't care.
 *
 * Path mapping:
 *   PKG_ROOT/.codesquad/<agents|skills|...>  → embedded key "<subpath>"
 *   PKG_ROOT/models.config.yaml            → embedded key "models.config.yaml"
 *   PKG_ROOT/codesquad.config.yaml         → embedded key "codesquad.config.yaml"
 *   PKG_ROOT/AGENTS.md                     → embedded key "AGENTS.md"
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { readEmbeddedFile, readEmbeddedDir, existsEmbeddedPath, isBunCompiled, } from './runtime.js';
// ── Package root ──
// Bun v1.1+ compiled binaries: import.meta.url starts with file://,
// so fileURLToPath works and gives the virtual ~BUN root.
// Bun v1.0 or tsx: fileURLToPath works normally.
// Bun v1.0 compiled (no file://): fileURLToPath throws → try-catch fallback.
export let PKG_ROOT;
export let AICORE_ROOT;
try {
    const __dirname = fileURLToPath(new URL('.', import.meta.url));
    // Bun-compiled: __dirname IS the binary's virtual root (no ../.. needed).
    PKG_ROOT = isBunCompiled ? __dirname : join(__dirname, '..', '..');
}
catch {
    // Pre-Bun 1.1 compiled binary: import.meta.url lacks file:// prefix.
    PKG_ROOT = '/__codesquad_bundle__';
}
AICORE_ROOT = join(PKG_ROOT, '.codesquad');
/**
 * Try to map an absolute filesystem path to an embedded-relative key.
 * Returns null if the path doesn't fall under a known embedded root.
 */
function toEmbeddedPath(absPath) {
    const normalized = absPath.replace(/\\/g, '/');
    // .codesquad content → strip AICORE_ROOT
    let aicoreNorm = AICORE_ROOT.replace(/\\/g, '/').replace(/\/+$/, '');
    if (normalized.startsWith(aicoreNorm + '/') || normalized === aicoreNorm) {
        const rel = relative(AICORE_ROOT, absPath).replace(/\\/g, '/');
        return rel || '.';
    }
    // Package-root files (models.config.yaml, codesquad.config.yaml, etc.)
    // Strip trailing slashes — PKG_ROOT may end with '\' in Bun-compiled mode.
    let pkgNorm = PKG_ROOT.replace(/\\/g, '/').replace(/\/+$/, '');
    if (normalized.startsWith(pkgNorm + '/') || normalized === pkgNorm) {
        return relative(PKG_ROOT, absPath).replace(/\\/g, '/');
    }
    return null;
}
/** Check existence (embedded first, then disk). Never throws. */
export function virtualExists(absPath) {
    const embeddedPath = toEmbeddedPath(absPath);
    if (embeddedPath && existsEmbeddedPath(embeddedPath))
        return true;
    try {
        return existsSync(absPath);
    }
    catch {
        return false;
    }
}
export function virtualReadFile(absPath, encoding) {
    const embeddedPath = toEmbeddedPath(absPath);
    if (embeddedPath) {
        const content = readEmbeddedFile(embeddedPath);
        if (content !== null) {
            return encoding === 'utf-8' || encoding === 'utf8'
                ? content
                : Buffer.from(content, 'utf-8');
        }
    }
    try {
        return readFileSync(absPath, encoding);
    }
    catch {
        throw new Error(`ENOENT: no such file or directory, stat '${absPath}'`);
    }
}
/**
 * List directory entries (strings only — no withFileTypes).
 * Embedded first, then disk.
 */
export function virtualReadDir(absPath) {
    const embeddedPath = toEmbeddedPath(absPath);
    if (embeddedPath) {
        const entries = readEmbeddedDir(embeddedPath);
        if (entries.length > 0)
            return entries;
    }
    if (existsSync(absPath)) {
        return readdirSync(absPath);
    }
    return [];
}
/**
 * Check whether a sub-path exists relative to an absolute base dir.
 * Convenience for skills scanning: `virtualExists(join(skillsDir, name, 'SKILL.md'))`
 */
export function virtualExistsSub(baseAbs, ...segments) {
    return virtualExists(join(baseAbs, ...segments));
}
/**
 * Resolve an absolute file path for reading, trying virtual-fs (embedded) first,
 * then falling back to disk. Use this as a drop-in replacement for `existsSync`
 * when the path might point to .codesquad embedded content.
 *
 * Returns true if the file exists in either the virtual filesystem or on disk.
 */
export function fileExists(absPath) {
    return virtualExists(absPath);
}
/**
 * Read file content as UTF-8 string, trying virtual-fs (embedded) first,
 * then falling back to disk. Use this as a drop-in replacement for
 * `readFileSync(path, 'utf-8')` when the path might point to .codesquad embedded content.
 */
export function fileRead(absPath) {
    return virtualReadFile(absPath, 'utf-8');
}
/**
 * Normalize .codesquad path references in text content that will be injected
 * into the LLM's context. In published builds, .codesquad content is embedded
 * in the binary and accessed via virtual-fs. This function ensures any
 * `.codesquad/` or `.codesquad\` path references remain consistent so the LLM
 * passes correct paths to tools (which resolve through virtual-fs).
 *
 * Transformations:
 *   1. Normalize backslashes to forward slashes in .codesquad paths
 *   2. Strip redundant `.codesquad/` prefix when the path already starts with
 *      `.codesquad/` (prevents double-prefix like `.codesquad/.codesquad/...`)
 */
export function sanitizeAicorePaths(text) {
    // Normalize Windows backslash in .codesquad paths: .codesquad\xxx → .codesquad/xxx
    return text.replace(/\.codesquad\\([^\s'"`)\]}>]*)/g, '.codesquad/$1');
}
/**
 * Pre-expand .codesquad file references in text by inlining the file content.
 * Handles backtick-quoted paths like `.codesquad/docs/xxx.md` and bare paths
 * like "Read .codesquad/docs/xxx.md" by replacing them with the file contents
 * from the virtual filesystem.
 *
 * This is essential for Bun-compiled binaries where the LLM cannot read
 * .codesquad files from disk — the content must be pre-inlined in the prompt.
 */
export function expandAicoreRefs(text) {
    // Step 1: Expand backtick-quoted .codesquad paths: `.codesquad/xxx/yyy.md`
    let result = text.replace(/`(.codesquad\/([^\s`]+\.md))`/gi, (_match, fullPath) => {
        const content = tryReadAicoreFile(fullPath);
        if (content !== null) {
            return `[Content of ${fullPath}]\n\n${content}`;
        }
        return _match; // keep original if not found
    });
    // Step 2: Expand "Read .codesquad/xxx.md" or "读取 .codesquad/xxx.md" patterns
    result = result.replace(/(?:Read|读取|查看|Check|检查)\s+`?(.codesquad\/([^\s`,.]+\.md))`?/gi, (_match, fullPath) => {
        const content = tryReadAicoreFile(fullPath);
        if (content !== null) {
            return `[Content of ${fullPath} — pre-loaded below]\n\n${content}`;
        }
        return _match;
    });
    return result;
}
/** Try to read an .codesquad file from the virtual filesystem. Returns null if not found. */
function tryReadAicoreFile(relativePath) {
    // Strip leading .codesquad/ prefix — AICORE_ROOT already points to the .codesquad directory
    const cleanPath = relativePath.replace(/^.codesquad[\/\\]/i, '');
    const absPath = join(AICORE_ROOT, cleanPath);
    if (!virtualExists(absPath))
        return null;
    try {
        return virtualReadFile(absPath, 'utf-8');
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=virtual-fs.js.map