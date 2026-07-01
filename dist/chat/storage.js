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
 * Per-session write queue: serializes concurrent saveSession() calls
 * targeting the same session ID, preventing data loss from interleaved writes.
 *
 * Pattern: each call chains onto the previous Promise for its session ID,
 * so writes execute sequentially within a session while different sessions
 * can write in parallel.
 */
const writeQueues = new Map();
/**
 * Save a session JSON atomically:
 * 1. Serialize via per-session write queue (prevents concurrent overwrites)
 * 2. Backup existing file to .bak (prevents data loss on crash)
 * 3. Write to a temp file with PID + unique suffix
 * 4. Rename over the target (atomic on most filesystems)
 */
export async function saveSession(data) {
    const record = data;
    const id = record.id;
    // Serialize writes per session: chain onto the previous write's Promise.
    // This ensures two concurrent saveSession() calls for the same session
    // don't interleave their tmpPath writes and silently overwrite each other.
    const prev = writeQueues.get(id) ?? Promise.resolve();
    const next = prev
        .then(() => doSaveSession(data))
        .finally(() => {
        // Clean up queue entry only if it's still our chain (no newer write queued)
        if (writeQueues.get(id) === next) {
            writeQueues.delete(id);
        }
    });
    writeQueues.set(id, next);
    return next;
}
/** Internal: perform the actual atomic write (called from serialized queue). */
async function doSaveSession(data) {
    await ensureSessionDir();
    const record = data;
    const id = record.id;
    const targetPath = join(sessionDir(), `${id}.json`);
    const bakPath = `${targetPath}.bak`;
    // PID + random suffix prevents same-process tmpPath collisions
    // (belt-and-suspenders: queue serializes writes, unique suffix is extra safety)
    const tmpPath = `${targetPath}.tmp.${process.pid}.${Date.now().toString(36)}`;
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
    try {
        await renameAsync(tmpPath, targetPath);
    }
    catch (renameErr) {
        console.error(`[storage] Atomic rename failed for ${id}: ${renameErr.message}`);
        try {
            await unlinkAsync(tmpPath);
        }
        catch { /* best-effort cleanup */ }
        throw renameErr;
    }
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
// ── Session ID Counter ──
import { readFileSync, writeFileSync } from 'fs';
const COUNTER_FILE = 'session-counter.txt';
function counterPath() {
    return join(codesquadHome(), COUNTER_FILE);
}
/** Read and increment the session counter. Returns the NEXT session ID. */
export function getNextSessionId() {
    const p = counterPath();
    let current = 0;
    try {
        const raw = readFileSync(p, 'utf-8');
        current = parseInt(raw.trim(), 10) || 0;
    }
    catch {
        // File doesn't exist yet — starts from 0
    }
    const next = current + 1;
    try {
        writeFileSync(p, String(next), 'utf-8');
    }
    catch { /* best effort */ }
    return next;
}
/** Reset the session counter to 0 (project init). */
export function resetSessionCounter() {
    try {
        writeFileSync(counterPath(), '0', 'utf-8');
    }
    catch { /* best effort */ }
}
//# sourceMappingURL=storage.js.map