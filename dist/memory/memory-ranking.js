/**
 * Memory Ranking — usage-based memory sorting and cold detection.
 *
 * Uses a JSON file (or SQLite in future) to track hit counts and
 * last-hit timestamps for memory files. Ranks memories by:
 *   score = 0.6 * log2(hits+1) + 0.4 * max(0, 1 - ageDays/180)
 *
 * Three-tier degradation:
 *   Level 1: Stats file available → weighted ranking
 *   Level 2: Stats corrupted → rebuild from frontmatter (future: SQLite)
 *   Level 3: No stats → pure mtime sort
 *
 * References:
 *   Idea/tutrue/memory-system-design.md §3.0-§3.6
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
// ── DB helpers ──
function statsDbPath(memoryDir) {
    return join(dirname(memoryDir), '.memory_stats.json');
}
function loadStatsDb(memoryDir) {
    const path = statsDbPath(memoryDir);
    try {
        if (!existsSync(path))
            return {};
        return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch {
        return {};
    }
}
function saveStatsDb(memoryDir, db) {
    const path = statsDbPath(memoryDir);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(db, null, 2), 'utf-8');
}
// ── API ──
/**
 * Rank memory files by usage frequency and recency.
 */
export function rankByUsage(files, memoryDir) {
    const db = loadStatsDb(memoryDir);
    return files
        .map((f) => {
        const stats = db[f.filename];
        const hits = stats?.hits ?? 0;
        const ageDays = (Date.now() - f.mtimeMs) / 86_400_000;
        const hitsScore = Math.log2(hits + 1);
        const ageScore = Math.max(0, 1 - ageDays / 180);
        const score = 0.6 * hitsScore + 0.4 * ageScore;
        return { ...f, score };
    })
        .sort((a, b) => b.score - a.score);
}
/**
 * Record a hit on a memory file (increment usage counter).
 */
export function recordHits(fileNames, memoryDir) {
    const db = loadStatsDb(memoryDir);
    const now = Date.now();
    for (const name of fileNames) {
        if (db[name]) {
            db[name].hits = (db[name].hits || 0) + 1;
            db[name].lastHit = now;
        }
        else {
            // New entry
            let mtime = now;
            try {
                mtime = statSync(join(memoryDir, name)).mtimeMs;
            }
            catch { /* ignore */ }
            db[name] = {
                hits: 1,
                lastHit: now,
                createdAt: now,
                lastWrite: mtime,
            };
        }
    }
    saveStatsDb(memoryDir, db);
}
/**
 * Detect cold memories (0 hits, last hit > threshold days ago).
 */
export function detectColdMemories(memoryDir, thresholdDays = 30) {
    const db = loadStatsDb(memoryDir);
    const cutoff = Date.now() - thresholdDays * 86_400_000;
    const cold = [];
    for (const [path, stats] of Object.entries(db)) {
        if ((stats.hits === 0 || stats.hits === undefined) &&
            (!stats.lastHit || stats.lastHit < cutoff)) {
            cold.push(path);
        }
    }
    return cold;
}
/**
 * Get stats for a specific memory file.
 */
export function getMemoryStats(filename, memoryDir) {
    const db = loadStatsDb(memoryDir);
    const entry = db[filename];
    if (!entry)
        return undefined;
    return { path: filename, ...entry };
}
/**
 * Rebuild stats from memory file frontmatter (degradation recovery).
 * Scans frontmatter for hits/last_hit fields.
 */
export function rebuildFromFrontmatter(fileNames, memoryDir) {
    const db = {};
    const now = Date.now();
    for (const name of fileNames) {
        try {
            const path = join(memoryDir, name);
            const raw = readFileSync(path, 'utf-8');
            const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            let hits = 0;
            let lastHit = 0;
            if (fmMatch) {
                const hitsMatch = fmMatch[1]?.match(/^hits\s*:\s*(\d+)/m);
                const lastHitMatch = fmMatch[1]?.match(/^last_hit\s*:\s*(.+)$/m);
                hits = hitsMatch ? parseInt(hitsMatch[1], 10) : 0;
                lastHit = lastHitMatch ? new Date(lastHitMatch[1]).getTime() : 0;
            }
            const mtime = statSync(path).mtimeMs;
            db[name] = { hits, lastHit: lastHit || mtime, createdAt: mtime, lastWrite: mtime };
        }
        catch {
            // Skip if file is inaccessible
        }
    }
    saveStatsDb(memoryDir, db);
    return db;
}
/**
 * Initialize ranking database.
 */
export function initRankingDb(memoryDir) {
    if (!existsSync(statsDbPath(memoryDir))) {
        saveStatsDb(memoryDir, {});
    }
}
//# sourceMappingURL=memory-ranking.js.map