/**
 * Session data model and CRUD operations.
 *
 * Each REPL conversation is stored as a Session object identified by numeric ID.
 * Phase 1.2 — Steps 1.2.1, 1.2.3.
 */
import { getNextSessionId } from './storage.js';
import { join } from 'path';
import { readdirSync } from 'fs';
import { successResult, errorResult } from '../core/task-result.js';
import { saveSession, loadSession, deleteSession, sessionDir, ensureSessionDir, } from './storage.js';
// ── Factory ──
export function createSession(agent, modelConfig, name) {
    const now = new Date().toISOString();
    const id = String(getNextSessionId());
    return {
        id,
        name: name ?? `${agent}: 新会话`,
        createdAt: now,
        updatedAt: now,
        agent,
        messages: [],
        context: { injectedFiles: [], injectedContent: '' },
        modelConfig,
        status: 'active',
        turnCount: 0,
        lastCompactTurn: 0,
        lastAssistantTimestamp: '',
        agentSpawnCount: 0,
    };
}
// ── CRUD ──
export async function save(session) {
    session.updatedAt = new Date().toISOString();
    await ensureSessionDir();
    await saveSession(session);
}
export async function load(id) {
    const data = await loadSession(id);
    if (data === null || data === undefined)
        return null;
    // Validate shape — corrupted or externally edited JSON could break the REPL
    if (!isValidSession(data)) {
        return null;
    }
    return data;
}
function isValidSession(obj) {
    if (obj === null || typeof obj !== 'object')
        return false;
    const s = obj;
    return (typeof s['id'] === 'string' &&
        typeof s['name'] === 'string' &&
        typeof s['createdAt'] === 'string' &&
        typeof s['updatedAt'] === 'string' &&
        typeof s['agent'] === 'string' &&
        Array.isArray(s['messages']) &&
        typeof s['context'] === 'object' &&
        s['context'] !== null &&
        typeof s['modelConfig'] === 'object' &&
        s['modelConfig'] !== null &&
        (s['status'] === 'active' || s['status'] === 'idle' || s['status'] === 'archived'));
}
export async function remove(id) {
    await deleteSession(id);
}
// ── P3: TaskResult-wrapped versions ──
/**
 * Save a session and return a TaskResult instead of void.
 * Use this for new code; original save() remains for backward compat.
 */
export async function saveWithResult(session) {
    const startMs = Date.now();
    try {
        session.updatedAt = new Date().toISOString();
        await ensureSessionDir();
        await saveSession(session);
        return successResult(session, { taskId: session.id, durationMs: Date.now() - startMs });
    }
    catch (err) {
        return errorResult({
            taskId: session.id,
            errorCode: 'SESSION_SAVE_FAILED',
            message: `Failed to save session: ${err.message}`,
            durationMs: Date.now() - startMs,
        });
    }
}
/**
 * Remove a session and return a TaskResult instead of void.
 * Use this for new code; original remove() remains for backward compat.
 */
export async function removeWithResult(id) {
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
export function getSessionPath(id) {
    return join(sessionDir(), `${id}.json`);
}
export async function listSessions() {
    await ensureSessionDir();
    const dir = sessionDir();
    try {
        const files = readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('.'));
        const summaries = [];
        for (const file of files) {
            try {
                const session = await loadSession(file.replace('.json', ''));
                if (isValidSession(session)) {
                    summaries.push({
                        id: session.id,
                        idShort: session.id.slice(0, 8),
                        name: session.name,
                        agent: session.agent,
                        updatedAt: session.updatedAt,
                        messageCount: session.messages.length,
                        status: session.status,
                    });
                }
            }
            catch {
                // S12: skip corrupted files but log the warning
                console.warn(`[session] Skipped corrupted file: ${file}`);
            }
        }
        // Sort by updatedAt descending
        summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return summaries;
    }
    catch {
        // S12: directory read failed — log and return empty list
        console.warn('[session] Failed to read session directory');
        return [];
    }
}
export async function findSessionById(partial) {
    const sessions = await listSessions();
    const match = sessions.find((s) => s.id.startsWith(partial) || s.idShort.startsWith(partial));
    if (!match)
        return null;
    return load(match.id);
}
// ── Message helpers ──
export function addMessage(session, role, content, isContext = false) {
    const msg = {
        role,
        content,
        timestamp: new Date().toISOString(),
        isContext,
    };
    session.messages.push(msg);
    session.updatedAt = msg.timestamp;
    return msg;
}
export function getRecentMessages(session, count) {
    return session.messages.slice(-count);
}
/**
 * Delete a message from the session by index (1-based for user-facing commands).
 * Returns the deleted message or null if index is out of range.
 */
export function deleteMessage(session, index1Based) {
    const idx = index1Based - 1;
    if (idx < 0 || idx >= session.messages.length)
        return null;
    const [removed] = session.messages.splice(idx, 1);
    session.updatedAt = new Date().toISOString();
    return removed ?? null;
}
//# sourceMappingURL=session.js.map