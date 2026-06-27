/**
 * virtual-fs — Unified file system for embedded + on-disk access.
 *
 * In Bun-compiled mode, AICore content and config files are baked into the
 * binary.  In Node.js / npm-link mode they live on disk.  This module wraps
 * both sources behind a single API so callers don't care.
 *
 * Path mapping:
 *   PKG_ROOT/AICore/<agents|skills|...>  → embedded key "<subpath>"
 *   PKG_ROOT/models.config.yaml            → embedded key "models.config.yaml"
 *   PKG_ROOT/codesquad.config.yaml         → embedded key "codesquad.config.yaml"
 *   PKG_ROOT/AGENTS.md                     → embedded key "AGENTS.md"
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { readEmbeddedFile, readEmbeddedDir, existsEmbeddedPath, } from './runtime.js';
// ── Package root (same as web server's PKG_ROOT) ──
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PKG_ROOT = join(__dirname, '..', '..');
const AICORE_ROOT = join(PKG_ROOT, 'AICore');
/**
 * Try to map an absolute filesystem path to an embedded-relative key.
 * Returns null if the path doesn't fall under a known embedded root.
 */
function toEmbeddedPath(absPath) {
    const normalized = absPath.replace(/\\/g, '/');
    // AICore content → strip AICORE_ROOT
    const aicoreNorm = AICORE_ROOT.replace(/\\/g, '/');
    if (normalized.startsWith(aicoreNorm + '/') || normalized === aicoreNorm) {
        const rel = relative(AICORE_ROOT, absPath).replace(/\\/g, '/');
        return rel || '.';
    }
    // Package-root files (models.config.yaml, codesquad.config.yaml, etc.)
    const pkgNorm = PKG_ROOT.replace(/\\/g, '/');
    if (normalized.startsWith(pkgNorm + '/') || normalized === pkgNorm) {
        return relative(PKG_ROOT, absPath).replace(/\\/g, '/');
    }
    return null;
}
/** Check existence (embedded first, then disk). */
export function virtualExists(absPath) {
    const embeddedPath = toEmbeddedPath(absPath);
    if (embeddedPath && existsEmbeddedPath(embeddedPath))
        return true;
    return existsSync(absPath);
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
    return readFileSync(absPath, encoding);
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
 * when the path might point to AICore embedded content.
 *
 * Returns true if the file exists in either the virtual filesystem or on disk.
 */
export function fileExists(absPath) {
    return virtualExists(absPath);
}
/**
 * Read file content as UTF-8 string, trying virtual-fs (embedded) first,
 * then falling back to disk. Use this as a drop-in replacement for
 * `readFileSync(path, 'utf-8')` when the path might point to AICore embedded content.
 */
export function fileRead(absPath) {
    return virtualReadFile(absPath, 'utf-8');
}
/**
 * Normalize AICore path references in text content that will be injected
 * into the LLM's context. In published builds, AICore content is embedded
 * in the binary and accessed via virtual-fs. This function ensures any
 * `AICore/` or `AICore\` path references remain consistent so the LLM
 * passes correct paths to tools (which resolve through virtual-fs).
 *
 * Transformations:
 *   1. Normalize backslashes to forward slashes in AICore paths
 *   2. Strip redundant `AICore/` prefix when the path already starts with
 *      `AICore/` (prevents double-prefix like `AICore/AICore/...`)
 */
export function sanitizeAicorePaths(text) {
    // Normalize Windows backslash in AICore paths: AICore\xxx → AICore/xxx
    let result = text.replace(/\bAICore\\([^\s'"`)\]}>]*)/g, 'AICore/$1');
    // Fix double-prefix: AICore/AICore/xxx → AICore/xxx
    result = result.replace(/\bAICore\/AICore\//g, 'AICore/');
    return result;
}
//# sourceMappingURL=virtual-fs.js.map