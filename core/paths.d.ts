/**
 * paths — Shared path resolution for CLI package assets
 *
 * The CLI ships with two companion asset directories that live next to the
 * package itself, not the target project:
 *
 *   AICore/                            canonical agent & skill definitions
 *   CCGS Skill Testing Framework/      catalog, rubric, spec files
 *
 * Both should be resolved relative to the CLI package root (`__dirname/../..`)
 * so the CLI works regardless of the user's current working directory.
 * Earlier code used `process.cwd()` which silently broke when the CLI was
 * installed globally and invoked from a different project directory.
 *
 * ── Embedded Mode (Bun compile) ──
 * When the CLI is compiled via `bun build --compile`, the AICore content
 * is embedded in the binary. This module detects the runtime mode and
 * provides unified file I/O that works in both dev and compiled modes.
 */
/** Absolute path to the installed codesquad package root. */
export declare const CLI_PACKAGE_ROOT: string;
/** Absolute path to the AICore asset directory (canonical agent & skill defs). */
export declare const AICORE_ROOT: string;
/** Absolute path to the AICore/agents subdirectory. */
export declare const AICORE_AGENTS_DIR: string;
/** Absolute path to the AICore/skills subdirectory. */
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
/** The content source path (private package if available, else bundled AICore) */
export declare const AICORE_CONTENT_ROOT: string;
/** Absolute path to the project file install config. */
export declare const PROJECT_INSTALL_CONFIG_PATH: string;
/** Absolute path to the user-level .codesquad root (~/.codesquad/).
 *  External tools (e.g. graphify install --platform codesquad) place files here. */
export declare const CODESQUAD_USER_ROOT: string;
/** User-level .codesquad subdirectory for a given category. */
export declare function getCodeSquadUserCategory(category: 'agents' | 'skills' | 'rules' | 'hooks'): string;
/** User-level .codesquad/settings.json path. */
export declare const CODESQUAD_USER_SETTINGS: string;
/**
 * Get the project-level .codesquad root for a given working directory.
 * Defaults to process.cwd().
 */
export declare function getCodeSquadProjectRoot(cwd?: string): string;
export declare function getCodeSquadProjectCategory(category: 'agents' | 'skills' | 'rules' | 'hooks', cwd?: string): string;
/**
 * Whether the CLI is running as a Bun-compiled binary.
 * In embedded mode, AICore content is read from in-memory string constants
 * rather than disk files.
 */
export declare function isEmbeddedMode(): boolean;
/**
 * Unified AICore file read interface.
 * Embedded mode → reads from in-memory embedded data
 * Dev mode → reads from AICore/ disk directory
 *
 * @param relativePath Path relative to AICore root (e.g. "agents/game-designer.md")
 * @returns File content as string, or null if not found
 */
export declare function readAicoreFile(relativePath: string): string | null;
/**
 * Unified AICore directory listing (readdir semantics).
 * Embedded mode → reads from in-memory directory index
 * Dev mode → reads from AICore/ disk directory
 *
 * @param relativeDir Path relative to AICore root (e.g. "agents", "skills/adopt")
 * @returns Array of entry names, or empty array if dir not found
 */
export declare function readAicoreDir(relativeDir: string): string[];
/**
 * Check if a path exists under AICore root.
 */
export declare function existsAicorePath(relativePath: string): boolean;
//# sourceMappingURL=paths.d.ts.map