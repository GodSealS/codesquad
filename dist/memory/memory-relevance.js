/**
 * Memory Relevance — finds the most relevant memory files for a query.
 *
 * Two-phase selection:
 *   Phase 1: Keyword/BM25 pre-filtering (Top-20, no LLM)
 *   Phase 2: LLM refinement (Top-5, sideQuery with light model)
 *
 * Turn-level caching prevents redundant scans within the same conversation turn.
 *
 * References:
 *   Claude Code src/memdir/findRelevantMemories.ts
 *   Idea/tutrue/memory-system-design.md §2.3.4
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { memoryFreshnessNote } from './memory-age.js';
import { rankByUsage, recordHits } from './memory-ranking.js';
let _turnCounter = 0;
const _turnCache = new Map();
/** Advance the turn counter (called at the start of each conversation turn). */
export function advanceMemoryTurn() {
    _turnCounter++;
}
// ── Frontmatter Parser ──
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
function parseMemoryFrontmatter(path) {
    try {
        const raw = readFileSync(path, 'utf-8');
        const match = raw.match(FRONTMATTER_RE);
        if (!match)
            return null;
        const fm = match[1] ?? '';
        const nameMatch = fm.match(/^name\s*:\s*"?(.+?)"?$/m);
        const descMatch = fm.match(/^description\s*:\s*"?(.+?)"?$/m);
        const typeMatch = fm.match(/^type\s*:\s*(\w+)$/m);
        return {
            name: nameMatch?.[1]?.trim() ?? 'Unknown',
            description: descMatch?.[1]?.trim() ?? '',
            type: typeMatch?.[1]?.trim(),
        };
    }
    catch {
        return null;
    }
}
// ── Phase 1: Keyword Pre-filtering ──
function keywordScore(text, query) {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (queryTerms.length === 0)
        return 0;
    const lowerText = text.toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
        if (lowerText.includes(term)) {
            score += 1 + (term.length / 10); // longer matches weight more
        }
        // Bonus for exact boundary match
        const boundaryRe = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (boundaryRe.test(lowerText))
            score += 0.5;
    }
    return score;
}
// ── Phase 2: Simple LLM Selection (placeholder) ──
/**
 * Select top-N from candidates using simple heuristics.
 * In full implementation, this would call a lightweight LLM (Sonnet sideQuery).
 */
function selectTopMemories(candidates, topN) {
    // Sort by keyword score, then by mtime (newer first)
    return candidates
        .sort((a, b) => {
        if (b.score !== a.score)
            return b.score - a.score;
        // Tie-break by mtime
        try {
            const aTime = statSync(a.path).mtimeMs;
            const bTime = statSync(b.path).mtimeMs;
            return bTime - aTime;
        }
        catch {
            return 0;
        }
    })
        .slice(0, topN);
}
// ── API ──
/**
 * Find the most relevant memory files for a given query.
 *
 * @param query - User query / conversation context
 * @param memoryDir - Path to the memory directory
 * @param _signal - AbortSignal for cancellation (unused in MVP)
 * @param _recentTools - Recently used tools for filtering (unused in MVP)
 * @param alreadySurfaced - Set of already-surfaced filenames to exclude
 */
export function findRelevantMemories(query, memoryDir, _signal, _recentTools, alreadySurfaced) {
    // Check turn-level cache
    const cacheKey = `${memoryDir}:${_turnCounter}`;
    const cached = _turnCache.get(cacheKey);
    if (cached) {
        // Filter out already-surfaced entries
        if (alreadySurfaced && alreadySurfaced.size > 0) {
            return cached.results.filter((r) => !alreadySurfaced.has(r.filename));
        }
        return cached.results;
    }
    // Scan memory files
    let files;
    try {
        files = readdirSync(memoryDir).filter((f) => f.endsWith('.md'));
    }
    catch {
        return [];
    }
    // Phase 1: Keyword pre-filtering
    const candidates = [];
    for (const file of files) {
        const filePath = join(memoryDir, file);
        const fm = parseMemoryFrontmatter(filePath);
        if (!fm)
            continue;
        const combinedText = `${fm.name} ${fm.description}`;
        const score = keywordScore(combinedText, query);
        if (files.length <= 20 || score > 0) {
            candidates.push({
                filename: file,
                path: filePath,
                name: fm.name,
                description: fm.description,
                type: fm.type,
                score,
            });
        }
    }
    // Phase 2: Rank by usage (M17) and select Top-5
    const ranked = rankByUsage(candidates.map((c) => ({ filename: c.filename, path: c.path, mtimeMs: statSync(c.path).mtimeMs })), memoryDir);
    const selected = ranked.slice(0, 5);
    // Record hits on selected memories (M17)
    recordHits(selected.map((s) => s.filename), memoryDir);
    // Build result with staleness notes
    const results = selected.map((s) => {
        let mtime = 0;
        try {
            mtime = statSync(s.path).mtimeMs;
        }
        catch { /* ignore */ }
        const c = candidates.find((cand) => cand.filename === s.filename);
        if (!c)
            return null;
        let content = '';
        try {
            content = readFileSync(c.path, 'utf-8').slice(0, 3000); // trim to ~750 tokens
        }
        catch { /* ignore */ }
        return {
            filename: c.filename,
            path: c.path,
            name: c.name,
            description: c.description,
            type: c.type,
            content,
            stalenessNote: memoryFreshnessNote(mtime),
            score: c.score,
        };
    });
    // Filter nulls + already-surfaced
    const nonNull = results.filter((r) => r !== null);
    const filtered = alreadySurfaced && alreadySurfaced.size > 0
        ? nonNull.filter((r) => !alreadySurfaced.has(r.filename))
        : nonNull;
    // Cache for this turn
    _turnCache.set(cacheKey, { turn: _turnCounter, results: filtered });
    return filtered;
}
//# sourceMappingURL=memory-relevance.js.map