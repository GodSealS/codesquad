/**
 * Team mailbox — file-based message passing between team members.
 *
 * Storage: .codesquad/teams/{teamName}/inboxes/{agentName}.json
 * Uses lockfile pattern (writeFileSync + retry) to prevent concurrent write conflicts.
 *
 * Feature 3 — P4 Team Collaboration
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
// ── Paths ──
function inboxDir(teamName) {
    return join(process.cwd(), '.codesquad', 'teams', teamName, 'inboxes');
}
function inboxPath(teamName, agentName) {
    return join(inboxDir(teamName), `${agentName}.json`);
}
// ── Atomic write with lockfile ──
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 30;
/**
 * Write JSON atomically using a lockfile pattern.
 * Mirrors Claude Code's writeToMailbox atomic approach in teammateMailbox.ts.
 *
 * Algorithm:
 * 1. Write to a temp file first (avoids corruption on partial write)
 * 2. Acquire a lockfile (retry with backoff)
 * 3. Atomically rename temp → target
 * 4. Release lockfile
 */
function writeJsonAtomic(path, data) {
    const lockPath = path + '.lock';
    const tmpPath = path + '.' + randomUUID().slice(0, 8) + '.tmp';
    // Step 1: Write to temp file (can't corrupt the real file)
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    // Step 2: Acquire lock with retry
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Create lockfile exclusively (fails if already exists)
            writeFileSync(lockPath, '', { flag: 'wx', encoding: 'utf-8' });
            // Step 3: Atomic rename
            try {
                // On Windows, renameSync may fail if target exists, so delete first
                if (existsSync(path)) {
                    unlinkSync(path);
                }
                require('fs').renameSync(tmpPath, path);
            }
            catch (renameErr) {
                // Fallback: copy and delete
                const data = readFileSync(tmpPath, 'utf-8');
                writeFileSync(path, data, 'utf-8');
                try {
                    unlinkSync(tmpPath);
                }
                catch { /* ignore */ }
            }
            // Step 4: Release lock
            try {
                unlinkSync(lockPath);
            }
            catch { /* ignore */ }
            return;
        }
        catch {
            // Lockfile exists — another writer is active, retry
            if (attempt < MAX_RETRIES) {
                const start = Date.now();
                const delay = RETRY_DELAY_MS * (attempt + 1); // exponential backoff
                while (Date.now() - start < delay) { /* spin */ }
            }
        }
    }
    // All retries exhausted — force write without lock
    try {
        unlinkSync(lockPath);
    }
    catch { /* ignore */ }
    try {
        const data2 = readFileSync(tmpPath, 'utf-8');
        writeFileSync(path, data2, 'utf-8');
    }
    catch {
        // Last resort: use original slow path
        writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
    }
    try {
        unlinkSync(tmpPath);
    }
    catch { /* ignore */ }
}
// ── Mailbox CRUD ──
export function sendMessage(teamName, to, from, content, type = 'message', summary = '') {
    const dir = inboxDir(teamName);
    mkdirSync(dir, { recursive: true });
    const path = inboxPath(teamName, to);
    const existing = readMessages(teamName, to);
    const msg = {
        from,
        to,
        content,
        summary: summary || content.slice(0, 50),
        timestamp: new Date().toISOString(),
        type,
        read: false,
    };
    existing.push(msg);
    writeJsonAtomic(path, existing);
}
export function broadcastMessage(teamName, from, content, summary = '', memberNames = []) {
    for (const member of memberNames) {
        sendMessage(teamName, member, from, content, 'broadcast', summary);
    }
}
export function readMessages(teamName, agentName) {
    const path = inboxPath(teamName, agentName);
    if (!existsSync(path))
        return [];
    try {
        return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch {
        return [];
    }
}
export function getUnreadMessages(teamName, agentName) {
    return readMessages(teamName, agentName).filter((m) => !m.read);
}
export function markRead(teamName, agentName, timestamp) {
    const messages = readMessages(teamName, agentName);
    let changed = false;
    for (const msg of messages) {
        if (!msg.read && msg.timestamp <= timestamp) {
            msg.read = true;
            changed = true;
        }
    }
    if (changed) {
        const path = inboxPath(teamName, agentName);
        writeJsonAtomic(path, messages);
    }
}
export function clearInbox(teamName, agentName) {
    const path = inboxPath(teamName, agentName);
    writeJsonAtomic(path, []);
}
export function deleteInbox(teamName) {
    const dir = inboxDir(teamName);
    try {
        if (existsSync(dir)) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
    catch { /* ignore */ }
}
//# sourceMappingURL=mailbox.js.map