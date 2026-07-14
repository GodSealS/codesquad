/**
 * Memory Manager — singleton, scope-aware memory backend.
 *
 * Two independent memory stores:
 *   project — .codesquad/memory/ under project root (conversation + agent memories)
 *   global  — ~/.codesquad/memory/ (user decision preferences, tech choices)
 *
 * Usage:
 *   const mgr = getMemoryManager();
 *   await mgr.store(entry, 'project');
 *   const results = await mgr.retrieve({ query: 'React' }, 'global');
 *
 * References:
 *   Idea/tutrue/memory-system-design.md §2.3.8
 */
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { readMemoryIndexForScope, addMemoryEntryForScope, readMemoryFileForScope, writeMemoryFileForScope, readDailyLogForScope, getMemoryDirForScope, } from './workspace-memory.js';
import { getEverOSBackend } from './everos-bridge.js';
import { initRankingDb, detectColdMemories, rankByUsage } from './memory-ranking.js';
// ── Scoped Memory Store ──
class ScopedMemoryStore {
    scope;
    constructor(scope) {
        this.scope = scope;
    }
    get dir() {
        return getMemoryDirForScope(this.scope);
    }
    async store(entry) {
        const filename = sanitizeFilename(entry.name) + '.md';
        const content = formatMemoryFile(entry);
        writeMemoryFileForScope(filename, content, this.scope);
        addMemoryEntryForScope(entry.name, filename, entry.description, this.scope);
    }
    async retrieve(query) {
        const index = readMemoryIndexForScope(this.scope);
        const results = [];
        for (const idx of index) {
            if (query.source && !idx.title.toLowerCase().includes(query.source.toLowerCase()))
                continue;
            if (query.query) {
                const q = query.query.toLowerCase();
                if (!idx.title.toLowerCase().includes(q) && !idx.description.toLowerCase().includes(q))
                    continue;
            }
            const fileContent = readMemoryFileForScope(idx.file, this.scope);
            // Bug Fix #5: Parse type from frontmatter instead of description substring match
            let fmType;
            if (query.type) {
                fmType = fileContent ? extractFrontmatterType(fileContent) : undefined;
                if (!fmType || fmType !== query.type)
                    continue;
            }
            results.push({
                entry: {
                    name: idx.title,
                    description: idx.description,
                    type: (fmType ?? query.type ?? 'reference'),
                    content: fileContent ?? '',
                },
            });
        }
        return results.slice(0, query.limit ?? 10);
    }
    async list(filter) {
        const index = readMemoryIndexForScope(this.scope);
        return index.map((idx) => ({
            name: idx.title,
            description: idx.description,
            type: (filter?.type ?? 'reference'),
            content: '',
        }));
    }
    async delete(_id) {
        // Not implemented in MVP
    }
    async brief(sessionId) {
        const daily = readDailyLogForScope(undefined, this.scope);
        return {
            sessionId,
            summary: daily.slice(0, 500),
            keyTopics: [],
            lastActive: new Date(),
            messageCount: 0,
        };
    }
}
// ── Singleton Manager ──
export class MemoryManager {
    project;
    /** Global memory — uses EverOS when available, else local filesystem. */
    global;
    constructor() {
        this.project = new ScopedMemoryStore('project');
        // EverOS MCP takes priority for global memory (cross-project user preferences)
        const everosBackend = getEverOSBackend();
        if (everosBackend?.isAvailable()) {
            this.global = everosBackend;
        }
        else {
            this.global = new ScopedMemoryStore('global');
        }
        this.initRanking();
    }
    initRanking() {
        try {
            initRankingDb(this.project.dir);
            if (this.global instanceof ScopedMemoryStore) {
                initRankingDb(this.global.dir);
            }
        }
        catch { /* non-critical */ }
    }
    /** Store a memory entry in the given scope. */
    async store(entry, scope) {
        await this.storeForScope(scope).store(entry);
    }
    /** Retrieve memories matching the query from the given scope. */
    async retrieve(query, scope) {
        return this.storeForScope(scope).retrieve(query);
    }
    /** List all memory entries in the given scope. */
    async list(scope, filter) {
        return this.storeForScope(scope).list(filter);
    }
    /** Delete a memory by ID from the given scope. */
    async delete(id, scope) {
        await this.storeForScope(scope).delete(id);
    }
    /** Get a session brief from the given scope. */
    async brief(sessionId, scope) {
        return this.storeForScope(scope).brief(sessionId);
    }
    /** Get the internal store for a scope. */
    storeForScope(scope) {
        return scope === 'global' ? this.global : this.project;
    }
    // ── Convenience: Global memory guidance ──
    /**
     * Retrieve global memory as a system prompt section.
     * Used at session start for auto-mode decision guidance and dialog-mode risk alerts.
     */
    async getGlobalMemoryGuidance() {
        try {
            const prefs = await this.global.retrieve({ type: 'user', limit: 5 });
            const decisions = await this.global.retrieve({ type: 'project', limit: 3 });
            const all = [...prefs, ...decisions];
            if (all.length === 0)
                return '';
            const lines = [
                '## User Decision Preferences (from global memory)',
                'These preferences were learned from previous projects and conversations:',
                '',
            ];
            for (const r of all) {
                lines.push(`- **${r.entry.name}**: ${r.entry.description}`);
            }
            lines.push('');
            lines.push('When making decisions:');
            lines.push('1. In auto/craft mode, prefer these patterns unless the current context contradicts them.');
            lines.push('2. In dialog mode, proactively flag decisions that conflict with known preferences.');
            return lines.join('\n');
        }
        catch {
            return '';
        }
    }
    // ── Static helpers ──
    /** Get cold (unused) memory files from the given scope. */
    getColdMemories(scope = 'project') {
        const store = this.storeForScope(scope);
        if (!(store instanceof ScopedMemoryStore))
            return []; // EverOS: not applicable
        try {
            return detectColdMemories(store.dir, 30);
        }
        catch {
            return [];
        }
    }
    /** Get hot (frequently accessed) memory files from the given scope. */
    getHotMemories(limit = 10, scope = 'project') {
        const store = this.storeForScope(scope);
        if (!(store instanceof ScopedMemoryStore))
            return []; // EverOS: not applicable
        try {
            const dir = store.dir;
            const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
            const ranked = rankByUsage(files.map((f) => {
                let mtimeMs = 0;
                try {
                    mtimeMs = statSync(join(dir, f)).mtimeMs;
                }
                catch { /* ignore */ }
                return { filename: f, path: join(dir, f), mtimeMs };
            }), dir);
            return ranked.slice(0, limit).map((r) => r.filename);
        }
        catch {
            return [];
        }
    }
    // ── Singleton ──
    static _instance = null;
    static instance() {
        if (!MemoryManager._instance) {
            MemoryManager._instance = new MemoryManager();
        }
        return MemoryManager._instance;
    }
    /** Reset singleton (for tests). */
    static reset() {
        MemoryManager._instance = null;
    }
}
/** Convenience accessor for the singleton MemoryManager. */
export function getMemoryManager() {
    return MemoryManager.instance();
}
// ── Legacy compat: MemoryBackend interface ──
/** Minimal MemoryBackend compat — prefer using MemoryManager directly. */
export class LocalMemoryBackend {
    _store;
    constructor(scope = 'project') {
        this._store = new ScopedMemoryStore(scope);
    }
    async store(entry) { await this._store.store(entry); }
    async retrieve(query) { return this._store.retrieve(query); }
    async list(filter) { return this._store.list(filter); }
    async delete(id) { await this._store.delete(id); }
    async brief(sessionId) { return this._store.brief(sessionId); }
}
// ── Helpers ──
/** Extract type field from frontmatter content. */
function extractFrontmatterType(content) {
    const match = content.match(/^type\s*:\s*(\w+)/m);
    return match?.[1];
}
function sanitizeFilename(name) {
    return name
        .toLowerCase()
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}
function formatMemoryFile(entry) {
    const today = new Date().toISOString().slice(0, 10);
    const lines = [
        '---',
        `name: "${entry.name}"`,
        `description: "${entry.description}"`,
        `type: ${entry.type}`,
    ];
    if (entry.tags && entry.tags.length > 0) {
        lines.push(`tags: [${entry.tags.join(', ')}]`);
    }
    if (entry.source)
        lines.push(`source: ${entry.source}`);
    lines.push(`created: ${entry.created ?? today}`);
    lines.push(`updated: ${entry.updated ?? today}`);
    lines.push('---');
    lines.push('');
    lines.push(entry.content);
    return lines.join('\n');
}
//# sourceMappingURL=manager.js.map