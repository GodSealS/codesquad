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
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { virtualExists, virtualReadFile, virtualReadDir, } from '../embedded/virtual-fs.js';
import { isBunCompiled } from '../embedded/runtime.js';
let __filename;
let __dirname;
try {
    __filename = fileURLToPath(import.meta.url);
    __dirname = dirname(__filename);
}
catch {
    // Bun v1.0 compiled: import.meta.url has no file:// prefix.
    // fileURLToPath throws → use sentinel that matches virtual-fs.ts fallback.
    __dirname = '/__codesquad_bundle__';
    __filename = '/__codesquad_bundle__/src/core/paths.js';
}
/** Absolute path to the installed codesquad package root. */
// Bun-compiled: import.meta.url gives the binary's virtual root (no ../.. needed).
// npm/dev:     __dirname = <pkg>/src/core → go up 2 to reach <pkg>.
export const CLI_PACKAGE_ROOT = isBunCompiled
    ? __dirname
    : resolve(__dirname, '..', '..');
/** Absolute path to the AICore asset directory (canonical agent & skill defs). */
export const AICORE_ROOT = join(CLI_PACKAGE_ROOT, 'AICore');
/** Absolute path to the AICore/agents subdirectory. */
export const AICORE_AGENTS_DIR = join(AICORE_ROOT, 'agents');
/** Absolute path to the AICore/skills subdirectory. */
export const AICORE_SKILLS_DIR = join(AICORE_ROOT, 'skills');
/** Absolute path to the CCGS Skill Testing Framework directory. */
export const CCGS_ROOT = join(CLI_PACKAGE_ROOT, 'CCGS Skill Testing Framework');
/** Absolute path to the CCGS catalog.yaml file. */
export const CCGS_CATALOG_PATH = join(CCGS_ROOT, 'catalog.yaml');
/** Absolute path to the CCGS quality-rubric.md file. */
export const CCGS_RUBRIC_PATH = join(CCGS_ROOT, 'quality-rubric.md');
/** Absolute path to the CCGS skills/ spec directory. */
export const CCGS_SKILLS_SPEC_DIR = join(CCGS_ROOT, 'skills');
/** Absolute path to the CCGS agents/ spec directory. */
export const CCGS_AGENTS_SPEC_DIR = join(CCGS_ROOT, 'agents');
/** Absolute path to the CCGS templates/ directory. */
export const CCGS_TEMPLATES_DIR = join(CCGS_ROOT, 'templates');
/** Absolute path to the CLI's own package.json (for version reporting). */
export const CLI_PACKAGE_JSON = join(CLI_PACKAGE_ROOT, 'package.json');
/** Absolute path to the CLI's templates/ directory. */
export const CLI_TEMPLATES_DIR = join(CLI_PACKAGE_ROOT, 'templates');
/**
 * Absolute path to the optional @codesquad/aicore-content private package.
 * Falls back to the built-in AICORE_ROOT if the package is not installed.
 * Used for codesquad init to source full agent/skill definitions.
 */
let _aicoreContentRoot = null;
export function getAicoreContentRoot() {
    if (_aicoreContentRoot !== null)
        return _aicoreContentRoot;
    try {
        // Try resolving the private npm package
        const pkgPath = require.resolve('@codesquad/aicore-content/package.json', {
            paths: [CLI_PACKAGE_ROOT],
        });
        _aicoreContentRoot = resolve(pkgPath, '..');
        return _aicoreContentRoot;
    }
    catch {
        // Fallback to bundled AICore
        _aicoreContentRoot = AICORE_ROOT;
        return _aicoreContentRoot;
    }
}
/** The content source path (private package if available, else bundled AICore) */
export const AICORE_CONTENT_ROOT = getAicoreContentRoot();
/** Absolute path to the project file install config. */
export const PROJECT_INSTALL_CONFIG_PATH = join(CLI_PACKAGE_ROOT, 'Config', 'project_file_install_config.yaml');
// ── .codesquad registry paths (project-level overrides) ──
/** Centralized user-level .codesquad root directory.
 *  Priority: CODESQUAD_HOME env → USERPROFILE (Windows) → HOME (Unix) → fallback */
function resolveUserCodesquadRoot() {
    if (process.env.CODESQUAD_HOME)
        return process.env.CODESQUAD_HOME;
    const winHome = (process.env.HOMEDRIVE && process.env.HOMEPATH) ? process.env.HOMEDRIVE + process.env.HOMEPATH : '';
    const home = process.env.USERPROFILE || process.env.HOME || winHome;
    return join(home || '', '.codesquad');
}
/** Absolute path to the user-level .codesquad root (~/.codesquad/).
 *  External tools (e.g. graphify install --platform codesquad) place files here. */
export const CODESQUAD_USER_ROOT = resolveUserCodesquadRoot();
/** User-level .codesquad subdirectory for a given category. */
export function getCodeSquadUserCategory(category) {
    return join(CODESQUAD_USER_ROOT, category);
}
/** User-level .codesquad/settings.json path. */
export const CODESQUAD_USER_SETTINGS = join(CODESQUAD_USER_ROOT, 'settings.json');
/**
 * Get the project-level .codesquad root for a given working directory.
 * Defaults to process.cwd().
 */
export function getCodeSquadProjectRoot(cwd) {
    return join(cwd ?? process.cwd(), '.codesquad');
}
export function getCodeSquadProjectCategory(category, cwd) {
    return join(getCodeSquadProjectRoot(cwd), category);
}
// ── Embedded Mode ──────────────────────────────────────────
let _isEmbeddedMode = null;
/**
 * Whether the CLI is running as a Bun-compiled binary.
 * In embedded mode, AICore content is read from in-memory string constants
 * rather than disk files.
 */
export function isEmbeddedMode() {
    if (_isEmbeddedMode !== null)
        return _isEmbeddedMode;
    try {
        _isEmbeddedMode = isBunCompiled;
    }
    catch {
        _isEmbeddedMode = false;
    }
    return _isEmbeddedMode;
}
/**
 * Unified AICore file read interface.
 * Uses VirtualFS which transparently reads from embedded data or disk.
 *
 * @param relativePath Path relative to AICore root (e.g. "agents/game-designer.md")
 * @returns File content as string, or null if not found
 */
export function readAicoreFile(relativePath) {
    const fullPath = join(AICORE_ROOT, relativePath);
    if (!virtualExists(fullPath))
        return null;
    try {
        return virtualReadFile(fullPath, 'utf-8');
    }
    catch {
        return null;
    }
}
/**
 * Unified AICore directory listing (readdir semantics).
 * Uses VirtualFS which transparently reads from embedded data or disk.
 *
 * @param relativeDir Path relative to AICore root (e.g. "agents", "skills/adopt")
 * @returns Array of entry names, or empty array if dir not found
 */
export function readAicoreDir(relativeDir) {
    const fullPath = join(AICORE_ROOT, relativeDir);
    try {
        return virtualReadDir(fullPath);
    }
    catch {
        return [];
    }
}
/**
 * Check if a path exists under AICore root.
 * Uses VirtualFS which transparently checks embedded data or disk.
 */
export function existsAicorePath(relativePath) {
    return virtualExists(join(AICORE_ROOT, relativePath));
}
//# sourceMappingURL=paths.js.map