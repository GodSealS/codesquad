/**
 * File read state cache — enforces Read-then-Write pattern.
 *
 * Every FileReadTool call records the file content + mtime + hash.
 * FileWriteTool.checkPermissions() checks wasFileRead().
 * FileEditTool.validateInput() checks isFileStale().
 *
 * Phase 1.1
 */
import { createHash } from 'crypto';
import { existsSync, statSync } from 'fs';
// ── Hash helper ──
function hashContent(content) {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
// ── In-Memory Cache ──
export class InMemoryReadFileState {
    store = new Map();
    get(filePath) {
        return this.store.get(filePath);
    }
    set(filePath, entry) {
        this.store.set(filePath, entry);
    }
    has(filePath) {
        return this.store.has(filePath);
    }
    clear() {
        this.store.clear();
    }
}
// ── Public API ──
/**
 * Record a file read into the cache.
 */
export function recordFileRead(cache, filePath, content) {
    let mtimeMs = 0;
    try {
        mtimeMs = statSync(filePath).mtimeMs;
    }
    catch {
        // File may not exist on disk (virtual write)
    }
    cache.set(filePath, {
        filePath,
        content,
        mtimeMs,
        contentHash: hashContent(content),
        readAt: Date.now(),
    });
}
/**
 * Check if a file has been read in the current session.
 */
export function wasFileRead(cache, filePath) {
    return cache.has(filePath);
}
/**
 * Check if a file has been modified externally since it was last read.
 * Returns { stale: true, detail } if stale.
 */
export function checkFileStaleness(cache, filePath, newContent) {
    const entry = cache.get(filePath);
    if (!entry) {
        return { stale: false, detail: 'file not in read cache' };
    }
    // Check mtime first (fast)
    if (existsSync(filePath)) {
        try {
            const currentMtime = statSync(filePath).mtimeMs;
            if (currentMtime !== entry.mtimeMs && Math.abs(currentMtime - entry.mtimeMs) > 1000) {
                return { stale: true, detail: `file modified since read (mtime changed)` };
            }
        }
        catch {
            // stat failed — file may have been deleted
            return { stale: true, detail: 'file no longer exists' };
        }
    }
    // Content hash check if new content provided (definitive on Windows where mtime is coarse)
    if (newContent !== undefined) {
        const newHash = hashContent(newContent);
        if (newHash !== entry.contentHash) {
            return { stale: true, detail: 'content differs from read cache' };
        }
    }
    return { stale: false };
}
// ── Session-level management ──
let _sessionCache = null;
/** Get the session-level read file cache (lazy init). */
export function getSessionCache() {
    if (!_sessionCache) {
        _sessionCache = new InMemoryReadFileState();
    }
    return _sessionCache;
}
/** Reset the session-level cache (called on /clear or new session). */
export function clearSessionCache() {
    if (_sessionCache) {
        _sessionCache.clear();
    }
    _sessionCache = null;
}
//# sourceMappingURL=file-state.js.map