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
/** Check existence (embedded first, then disk). */
export declare function virtualExists(absPath: string): boolean;
/** Read file content as UTF-8 string (embedded first, then disk). */
export declare function virtualReadFile(absPath: string, encoding: BufferEncoding): string;
export declare function virtualReadFile(absPath: string): Buffer;
/**
 * List directory entries (strings only — no withFileTypes).
 * Embedded first, then disk.
 */
export declare function virtualReadDir(absPath: string): string[];
/**
 * Check whether a sub-path exists relative to an absolute base dir.
 * Convenience for skills scanning: `virtualExists(join(skillsDir, name, 'SKILL.md'))`
 */
export declare function virtualExistsSub(baseAbs: string, ...segments: string[]): boolean;
/**
 * Resolve an absolute file path for reading, trying virtual-fs (embedded) first,
 * then falling back to disk. Use this as a drop-in replacement for `existsSync`
 * when the path might point to AICore embedded content.
 *
 * Returns true if the file exists in either the virtual filesystem or on disk.
 */
export declare function fileExists(absPath: string): boolean;
/**
 * Read file content as UTF-8 string, trying virtual-fs (embedded) first,
 * then falling back to disk. Use this as a drop-in replacement for
 * `readFileSync(path, 'utf-8')` when the path might point to AICore embedded content.
 */
export declare function fileRead(absPath: string): string;
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
export declare function sanitizeAicorePaths(text: string): string;
//# sourceMappingURL=virtual-fs.d.ts.map