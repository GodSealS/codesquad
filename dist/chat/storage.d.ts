/**
 * Atomic-write JSON storage with cross-process file locking.
 *
 * Uses temporary file + rename (atomic) and proper-lockfile for
 * concurrent safety when multiple REPL instances access the same session.
 *
 * Storage location: <projectRoot>/.codesquad/  (project-scoped)
 * Fallback: ~/.codesquad/ (when no project root set, e.g. tests)
 *
 * Phase 1.2 — Step 1.2.2.
 */
import type { TaskResult } from '../core/task-result.js';
/**
 * Set the project root directory.
 * Must be called at startup before any storage operations.
 * After calling this, all data is stored under <projectRoot>/.codesquad/.
 */
export declare function setProjectRoot(root: string): void;
/**
 * Resolve the CodeSquad home directory.
 *
 * Priority:
 *   1. CODESQUAD_HOME env var (tests / custom override)
 *   2. _projectRoot/.codesquad  (project-scoped, set by setProjectRoot)
 *   3. ~/.codesquad             (fallback, no project root set)
 */
export declare function codesquadHome(): string;
export declare function sessionDir(): string;
export declare function exportsDir(): string;
/**
 * CodeSquad data directory relative to project root.
 * Exposed for external consumers that need the base path.
 */
export declare function projectDataDir(): string;
export declare function ensureSessionDir(): Promise<void>;
/**
 * Ensure session directories exist, returning a TaskResult.
 * Use this for new code; original ensureSessionDir() remains for backward compat.
 */
export declare function ensureSessionDirWithResult(): Promise<TaskResult<null>>;
/**
 * Save a session JSON atomically:
 * 1. Backup existing file to .bak (P1 fix: prevent data loss)
 * 2. Write to a temp file with PID suffix
 * 3. Rename over the target (atomic on most filesystems)
 *
 * For cross-process safety, callers should use saveSessionLocked().
 */
export declare function saveSession(data: unknown): Promise<void>;
/**
 * Load a session from disk. Handles partial writes by attempting
 * to recover from the temp file or .bak backup (P1 fix).
 */
export declare function loadSession(id: string): Promise<unknown | null>;
/**
 * Save a session and return a TaskResult instead of throwing.
 * Use this for new code; original saveSession remains for backward compat.
 */
export declare function saveSessionWithResult(data: unknown): Promise<TaskResult<null>>;
/**
 * Delete a session and return a TaskResult instead of void.
 */
export declare function deleteSessionWithResult(id: string): Promise<TaskResult<null>>;
/**
 * Delete a session file.
 */
export declare function deleteSession(id: string): Promise<void>;
//# sourceMappingURL=storage.d.ts.map