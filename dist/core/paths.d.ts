/**
 * paths — Shared path resolution for CLI package assets
 *
 * The CLI ships with two companion asset directories that live next to the
 * package itself, not the target project:
 *
 *   .codesquad/                            canonical agent & skill definitions
 *   CCGS Skill Testing Framework/      catalog, rubric, spec files
 *
 * Both should be resolved relative to the CLI package root (`__dirname/../..`)
 * so the CLI works regardless of the user's current working directory.
 * Earlier code used `process.cwd()` which silently broke when the CLI was
 * installed globally and invoked from a different project directory.
 *
 * ── Embedded Mode (Bun compile) ──
 * When the CLI is compiled via `bun build --compile`, the .codesquad content
 * is embedded in the binary. This module detects the runtime mode and
 * provides unified file I/O that works in both dev and compiled modes.
 */
/** Absolute path to the installed codesquad package root. */
export declare const CLI_PACKAGE_ROOT: string;
/** Absolute path to the .codesquad asset directory (canonical agent & skill defs). */
export declare const AICORE_ROOT: string;
/** Absolute path to the .codesquad/agents subdirectory. */
export declare const AICORE_AGENTS_DIR: string;
/** Absolute path to the .codesquad/skills subdirectory. */
export declare const AICORE_SKILLS_DIR: string;
/** Absolute path to the CCGS Skill Testing Framework directory. */
export declare const CCGS_ROOT: string;
/** Absolute path to the CCGS catalog.yaml file. */
export declare const CCGS_CATALOG_PATH: string;
/** Absolute path to the CCGS quality-rubric.md file. */
export declare const CCGS_RUBRIC_PATH: string;
/** Absolute path to the CCGS skills/ spec directory. */
export declare const CCGS_SKILLS_SPEC_DIR: string;
/** Absolute path to the CCGS agents/ spec directory. */
export declare const CCGS_AGENTS_SPEC_DIR: string;
/** Absolute path to the CCGS templates/ directory. */
export declare const CCGS_TEMPLATES_DIR: string;
/** Absolute path to the CLI's own package.json (for version reporting). */
export declare const CLI_PACKAGE_JSON: string;
/** Absolute path to the CLI's templates/ directory. */
export declare const CLI_TEMPLATES_DIR: string;
export declare function getAicoreContentRoot(): string;
/** The content source path (private package if available, else bundled .codesquad) */
export declare const AICORE_CONTENT_ROOT: string;
/** Absolute path to the project file install config. */
export declare const PROJECT_INSTALL_CONFIG_PATH: string;
/** Absolute path to the user-level .codesquad root (~/.codesquad/).
 *  External tools (e.g. graphify install --platform codesquad) place files here. */
export declare const CODESQUAD_USER_ROOT: string;
/** User-level .codesquad subdirectory for a given category. */
export declare function getCodeSquadUserCategory(category: 'agents' | 'skills' | 'rules' | 'hooks' | 'commands'): string;
/** User-level .codesquad/settings.json path. */
export declare const CODESQUAD_USER_SETTINGS: string;
/**
 * Get the project-level .codesquad root for a given working directory.
 * Defaults to process.cwd().
 */
export declare function getCodeSquadProjectRoot(cwd?: string): string;
export declare function getCodeSquadProjectCategory(category: 'agents' | 'skills' | 'rules' | 'hooks' | 'commands' | 'agent-assemblies', cwd?: string): string;
/**
 * Whether the CLI is running as a Bun-compiled binary.
 * In embedded mode, .codesquad content is read from in-memory string constants
 * rather than disk files.
 */
export declare function isEmbeddedMode(): boolean;
/**
 * Unified .codesquad file read interface.
 * Uses VirtualFS which transparently reads from embedded data or disk.
 *
 * @param relativePath Path relative to .codesquad root (e.g. "agents/game-designer.md")
 * @returns File content as string, or null if not found
 */
export declare function readAicoreFile(relativePath: string): string | null;
/**
 * Unified .codesquad directory listing (readdir semantics).
 * Uses VirtualFS which transparently reads from embedded data or disk.
 *
 * @param relativeDir Path relative to .codesquad root (e.g. "agents", "skills/adopt")
 * @returns Array of entry names, or empty array if dir not found
 */
export declare function readAicoreDir(relativeDir: string): string[];
/**
 * Resolve a file with 3-tier fallback:
 *   1. <project>/.codesquad/<relativePath>
 *   2.  ~/.codesquad/<relativePath>
 *   3.  <CLI>/.codesquad/<relativePath> (via VirtualFS)
 *
 * Returns { path, content } of the first found file, or null.
 */
export declare function resolveFileWithFallback(relativePath: string, projectRoot?: string): {
    path: string;
    content: string;
} | null;
/**
 * List directory entries with 3-tier merged view:
 *   1. <project>/.codesquad/<relativeDir>  — highest priority
 *   2.  ~/.codesquad/<relativeDir>
 *   3.  <CLI>/.codesquad/<relativeDir>         — lowest priority (VirtualFS)
 *
 * Entries in higher tiers override same-named entries in lower tiers.
 * Returns deduplicated merged array.
 */
export declare function resolveDirWithFallback(relativeDir: string, projectRoot?: string): string[];
/**
 * Check if a path exists under .codesquad root.
 * Uses VirtualFS which transparently checks embedded data or disk.
 */
export declare function existsAicorePath(relativePath: string): boolean;
/**
 * Check whether an absolute file path falls under a protected .codesquad subdirectory
 * (agents/ or skills/).  These contain proprietary agent/skill definitions that
 * must never be exposed to the user via tool output.
 *
 * @param absPath  Resolved absolute file path
 * @param aicoreDir  Absolute path to the .codesquad directory (e.g. context.aicoreDir)
 */
export declare function isProtectedAicorePath(absPath: string, aicoreDir: string): boolean;
//# sourceMappingURL=paths.d.ts.map