/**
 * Memory Manager — unified memory backend interface.
 *
 * Provides a single API for storing, retrieving, listing, and deleting
 * memories. Default implementation uses the local filesystem
 * (.codesquad/memory/). Phase 2 adds EverOS MCP backend support.
 *
 * References:
 *   Idea/tutrue/memory-system-design.md §2.3.8
 */
import { readdirSync } from 'fs';
import { join } from 'path';
import { readMemoryIndex, addMemoryEntry, readMemoryFile, writeMemoryFile, readDailyLog, getMemoryDir, } from './workspace-memory.js';
import { getEverOSBackend } from './everos-bridge.js';
import { initRankingDb, detectColdMemories, rankByUsage } from './memory-ranking.js';
// ── LocalMemoryBackend ──
export class LocalMemoryBackend {
    async store(entry) {
        const filename = `${entry.name.toLowerCase().replace(/\s+/g, '-')}.md`;
        const content = formatMemoryFile(entry);
        writeMemoryFile(filename, content);
        addMemoryEntry(entry.name, filename, entry.description);
    }
    async retrieve(query) {
        const index = readMemoryIndex();
        const results = [];
        for (const idx of index) {
            if (query.type && !idx.description.toLowerCase().includes(query.type))
                continue;
            if (query.query) {
                const q = query.query.toLowerCase();
                if (!idx.title.toLowerCase().includes(q) && !idx.description.toLowerCase().includes(q))
                    continue;
            }
            const fileContent = readMemoryFile(idx.file);
            results.push({
                entry: {
                    name: idx.title,
                    description: idx.description,
                    type: (query.type ?? 'reference'),
                    content: fileContent ?? '',
                },
            });
        }
        return results.slice(0, query.limit ?? 10);
    }
    async list(filter) {
        const index = readMemoryIndex();
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
        const daily = readDailyLog();
        return {
            sessionId,
            summary: daily.slice(0, 500),
            keyTopics: [],
            lastActive: new Date(),
            messageCount: 0,
        };
    }
}
// ── Factory ──
export function createMemoryManager() {
    // Initialize ranking database at startup (M18)
    try {
        const dir = getMemoryDir();
        initRankingDb(dir);
    }
    catch { /* ranking unavailable—non-critical */ }
    // Check for EverOS MCP backend (M15)
    const everosBackend = getEverOSBackend();
    if (everosBackend?.isAvailable()) {
        return everosBackend;
    }
    // Default: local filesystem backend (always available)
    return new LocalMemoryBackend();
}
/** Get list of cold memories (not accessed in 30+ days). */
export function getColdMemories() {
    try {
        return detectColdMemories(getMemoryDir(), 30);
    }
    catch {
        return [];
    }
}
/** Get list of hot memories (most frequently accessed). */
export function getHotMemories(limit = 10) {
    try {
        const dir = getMemoryDir();
        const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
        const ranked = rankByUsage(files.map((f) => ({ filename: f, path: join(dir, f), mtimeMs: 0 })), dir);
        return ranked.slice(0, limit).map((r) => r.filename);
    }
    catch {
        return [];
    }
}
// ── Helpers ──
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
    if (entry.scope)
        lines.push(`scope: ${entry.scope}`);
    lines.push(`created: ${entry.created ?? today}`);
    lines.push(`updated: ${entry.updated ?? today}`);
    lines.push('---');
    lines.push('');
    lines.push(entry.content);
    return lines.join('\n');
}
//# sourceMappingURL=manager.js.map