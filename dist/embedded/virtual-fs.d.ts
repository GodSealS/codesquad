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
export declare let PKG_ROOT: string;
export declare let AICORE_ROOT: string;
/** Check existence (embedded first, then disk). Never throws. */
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
 * when the path might point to .codesquad embedded content.
 *
 * Returns true if the file exists in either the virtual filesystem or on disk.
 */
export declare function fileExists(absPath: string): boolean;
/**
 * Read file content as UTF-8 string, trying virtual-fs (embedded) first,
 * then falling back to disk. Use this as a drop-in replacement for
 * `readFileSync(path, 'utf-8')` when the path might point to .codesquad embedded content.
 */
export declare function fileRead(absPath: string): string;
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
export declare function sanitizeAicorePaths(text: string): string;
/**
 * Pre-expand .codesquad file references in text by inlining the file content.
 * Handles backtick-quoted paths like `.codesquad/docs/xxx.md` and bare paths
 * like "Read .codesquad/docs/xxx.md" by replacing them with the file contents
 * from the virtual filesystem.
 *
 * This is essential for Bun-compiled binaries where the LLM cannot read
 * .codesquad files from disk — the content must be pre-inlined in the prompt.
 */
export declare function expandAicoreRefs(text: string): string;
//# sourceMappingURL=virtual-fs.d.ts.map