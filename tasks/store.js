/**
 * Task store — in-memory Map + JSON file persistence.
 *
 * Storage: <projectRoot>/.codesquad/tasks/<taskId>.json
 * Mirrors session persistence pattern from src/chat/storage.ts (atomic write).
 *
 * Feature 2 — P4 Task System
 */
import { randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
// ── Store root ──
let _tasksDir = '';
export function setTaskStoreRoot(projectRoot) {
    _tasksDir = join(projectRoot, '.codesquad', 'tasks');
}
function getTasksDir() {
    return _tasksDir || join(process.cwd(), '.codesquad', 'tasks');
}
function taskPath(id) {
    return join(getTasksDir(), `${id}.json`);
}
// ── In-memory cache ──
const tasks = new Map();
// ── File I/O ──
function persistTask(task) {
    const dir = getTasksDir();
    mkdirSync(dir, { recursive: true });
    // Strip non-serializable fields (AbortController)
    const { abortController, ...serializable } = task;
    writeFileSync(taskPath(task.id), JSON.stringify(serializable, null, 2), 'utf-8');
}
function loadTaskFromFile(id) {
    const path = taskPath(id);
    if (!existsSync(path))
        return null;
    try {
        return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch {
        return null;
    }
}
function loadAllTasks() {
    const dir = getTasksDir();
    if (!existsSync(dir))
        return [];
    const results = [];
    try {
        for (const f of readdirSync(dir)) {
            if (!f.endsWith('.json'))
                continue;
            const task = loadTaskFromFile(f.replace('.json', ''));
            if (task)
                results.push(task);
        }
    }
    catch { /* skip */ }
    return results;
}
// ── Init: hydrate from disk on first access ──
let _hydrated = false;
function ensureHydrated() {
    if (_hydrated)
        return;
    _hydrated = true;
    for (const task of loadAllTasks()) {
        tasks.set(task.id, task);
    }
}
// ── CRUD ──
export function createTask(task) {
    ensureHydrated();
    const newTask = {
        ...task,
        id: randomUUID(),
        status: 'pending',
        createdAt: new Date().toISOString(),
    };
    tasks.set(newTask.id, newTask);
    persistTask(newTask);
    return newTask;
}
export function getTask(id) {
    ensureHydrated();
    return tasks.get(id);
}
export function listTasks(sessionId) {
    ensureHydrated();
    const all = Array.from(tasks.values());
    if (sessionId) {
        return all.filter((t) => t.parentSessionId === sessionId);
    }
    return all;
}
export function updateTask(id, update) {
    ensureHydrated();
    const task = tasks.get(id);
    if (!task)
        return undefined;
    const updated = { ...task, ...update };
    tasks.set(id, updated);
    persistTask(updated);
    return updated;
}
export function deleteTask(id) {
    ensureHydrated();
    const deleted = tasks.delete(id);
    if (deleted) {
        try {
            unlinkSync(taskPath(id));
        }
        catch { /* ok */ }
    }
    return deleted;
}
export function stopTask(id) {
    ensureHydrated();
    // Find task by exact ID first, then prefix match (same logic as TaskGetTool)
    let task = tasks.get(id);
    if (!task) {
        for (const t of tasks.values()) {
            if (t.id.startsWith(id)) {
                task = t;
                break;
            }
        }
    }
    if (!task)
        return undefined;
    // Abort if running
    if (task.abortController && task.status === 'running') {
        task.abortController.abort();
    }
    return updateTask(task.id, {
        status: 'stopped',
        completedAt: new Date().toISOString(),
    });
}
export function getActiveTaskCount(sessionId) {
    ensureHydrated();
    return listTasks(sessionId).filter((t) => t.status === 'pending' || t.status === 'running').length;
}
export function clearTasks(sessionId) {
    ensureHydrated();
    if (sessionId) {
        for (const [id, task] of tasks) {
            if (task.parentSessionId === sessionId) {
                tasks.delete(id);
                try {
                    unlinkSync(taskPath(id));
                }
                catch { /* ok */ }
            }
        }
    }
    else {
        for (const [id] of tasks) {
            try {
                unlinkSync(taskPath(id));
            }
            catch { /* ok */ }
        }
        tasks.clear();
    }
}
//# sourceMappingURL=store.js.map