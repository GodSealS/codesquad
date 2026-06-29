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
import { readFile, writeFile, rename, unlink, mkdir, existsSync } from 'fs';
import { promisify } from 'util';
import { join } from 'path';
import { CODESQUAD_USER_ROOT } from '../core/paths.js';
import { successResult, errorResult } from '../core/task-result.js';
const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);
const renameAsync = promisify(rename);
const unlinkAsync = promisify(unlink);
const mkdirAsync = promisify(mkdir);
// ── Project root injection ──
let _projectRoot = null;
/**
 * Set the project root directory.
 * Must be called at startup before any storage operations.
 * After calling this, all data is stored under <projectRoot>/.codesquad/.
 */
export function setProjectRoot(root) {
    _projectRoot = resolve(root);
    // Reset directory-ensured flag so directories get re-created under new root
    dirsEnsured = false;
}
import { resolve } from 'path';
// ── Paths ──
/**
 * Resolve the CodeSquad home directory.
 *
 * Priority:
 *   1. CODESQUAD_HOME env var (tests / custom override)
 *   2. _projectRoot/.codesquad  (project-scoped, set by setProjectRoot)
 *   3. ~/.codesquad             (fallback, no project root set)
 */
export function codesquadHome() {
    if (process.env.CODESQUAD_HOME)
        return process.env.CODESQUAD_HOME;
    if (_projectRoot)
        return join(_projectRoot, '.codesquad');
    return CODESQUAD_USER_ROOT;
}
export function sessionDir() {
    return join(codesquadHome(), 'sessions');
}
export function exportsDir() {
    return join(codesquadHome(), 'exports');
}
/**
 * CodeSquad data directory relative to project root.
 * Exposed for external consumers that need the base path.
 */
export function projectDataDir() {
    if (_projectRoot)
        return join(_projectRoot, '.codesquad');
    return codesquadHome();
}
let dirsEnsured = false;
export async function ensureSessionDir() {
    if (dirsEnsured)
        return;
    await mkdirAsync(sessionDir(), { recursive: true });
    await mkdirAsync(exportsDir(), { recursive: true });
    dirsEnsured = true;
}
/**
 * Ensure session directories exist, returning a TaskResult.
 * Use this for new code; original ensureSessionDir() remains for backward compat.
 */
export async function ensureSessionDirWithResult() {
    const startMs = Date.now();
    try {
        await ensureSessionDir();
        return successResult(null, { durationMs: Date.now() - startMs });
    }
    catch (err) {
        return errorResult({
            errorCode: 'SESSION_SAVE_FAILED',
            message: `Failed to create session directories: ${err.message}`,
            durationMs: Date.now() - startMs,
        });
    }
}
// ── Atomic write ──
/**
 * Save a session JSON atomically:
 * 1. Backup existing file to .bak (P1 fix: prevent data loss)
 * 2. Write to a temp file with PID suffix
 * 3. Rename over the target (atomic on most filesystems)
 *
 * For cross-process safety, callers should use saveSessionLocked().
 */
export async function saveSession(data) {
    await ensureSessionDir();
    const record = data;
    const id = record.id;
    const targetPath = join(sessionDir(), `${id}.json`);
    const bakPath = `${targetPath}.bak`;
    const tmpPath = `${targetPath}.tmp.${process.pid}`;
    const json = JSON.stringify(data, null, 2);
    // P1 fix: Backup existing file before overwriting
    try {
        if (existsSync(targetPath)) {
            await renameAsync(targetPath, bakPath);
        }
    }
    catch {
        // S12: backup failure is non-fatal but worth logging
        console.warn('[storage] Backup rename failed, proceeding without backup');
    }
    // Write to temp file first (with retry)
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await writeFileAsync(tmpPath, json, 'utf-8');
            break;
        }
        catch {
            // S12: retryable write failure
            if (attempt === 2)
                throw new Error('SESSION_SAVE_FAILED');
            console.warn(`[storage] Write attempt ${attempt + 1}/3 failed, retrying...`);
            await new Promise(r => setTimeout(r, 100));
        }
    }
    // Atomic rename
    await renameAsync(tmpPath, targetPath);
}
/**
 * Load a session from disk. Handles partial writes by attempting
 * to recover from the temp file or .bak backup (P1 fix).
 */
export async function loadSession(id) {
    await ensureSessionDir();
    const targetPath = join(sessionDir(), `${id}.json`);
    const bakPath = `${targetPath}.bak`;
    const tmpPath = `${targetPath}.tmp.${process.pid}`;
    try {
        const raw = await readFileAsync(targetPath, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        // File missing or corrupted — try .bak recovery first (P1 fix)
        if (existsSync(bakPath)) {
            try {
                const raw = await readFileAsync(bakPath, 'utf-8');
                // Restore from backup
                await writeFileAsync(targetPath, raw, 'utf-8');
                return JSON.parse(raw);
            }
            catch {
                // .bak also corrupted — fall through to tmp
            }
        }
        // Try temp recovery
        if (existsSync(tmpPath)) {
            try {
                const raw = await readFileAsync(tmpPath, 'utf-8');
                await writeFileAsync(targetPath, raw, 'utf-8');
                return JSON.parse(raw);
            }
            catch {
                return null;
            }
        }
        return null;
    }
}
// ── P3: TaskResult-wrapped versions ──
/**
 * Save a session and return a TaskResult instead of throwing.
 * Use this for new code; original saveSession remains for backward compat.
 */
export async function saveSessionWithResult(data) {
    const taskId = data.id ?? '';
    const startMs = Date.now();
    try {
        await saveSession(data);
        return successResult(null, { taskId, durationMs: Date.now() - startMs });
    }
    catch (err) {
        return errorResult({
            taskId,
            errorCode: 'SESSION_SAVE_FAILED',
            message: `Failed to save session: ${err.message}`,
            durationMs: Date.now() - startMs,
        });
    }
}
/**
 * Delete a session and return a TaskResult instead of void.
 */
export async function deleteSessionWithResult(id) {
    const startMs = Date.now();
    try {
        await deleteSession(id);
        return successResult(null, { taskId: id, durationMs: Date.now() - startMs });
    }
    catch (err) {
        return errorResult({
            taskId: id,
            errorCode: 'INTERNAL_ERROR',
            message: `Failed to delete session: ${err.message}`,
            durationMs: Date.now() - startMs,
        });
    }
}
/**
 * Delete a session file.
 */
export async function deleteSession(id) {
    const targetPath = join(sessionDir(), `${id}.json`);
    try {
        await unlinkAsync(targetPath);
    }
    catch {
        // File already gone — that's fine
    }
}
//# sourceMappingURL=storage.js.map