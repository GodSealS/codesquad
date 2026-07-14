/**
 * Memory Relevance — finds the most relevant memory files for a query.
 *
 * Three-phase selection:
 *   Phase 1: Keyword/BM25 pre-filtering (Top-20, no LLM)
 *   Phase 2: Embedding-based semantic filter (cosine ≥ threshold) or keyword threshold fallback
 *   Phase 3: selectTopMemories — combined score + mtime sort → Top-5
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
import { recordHits } from './memory-ranking.js';
import { cosineSimilarity } from '../embedding/store.js';
// ── Thresholds ──
/** Minimum cosine similarity for embedding-based memory matching. */
const MIN_COSINE_SIMILARITY = 0.25;
/** Minimum keyword score when no embedding provider is available. */
const MIN_KEYWORD_SCORE = 1.5;
let _turnCounter = 0;
const _turnCache = new Map();
const MAX_TURN_CACHE_SIZE = 50; // prevent unbounded memory growth over long sessions
/** Advance the turn counter (called at the start of each conversation turn). */
export function advanceMemoryTurn() {
    _turnCounter++;
    // Periodic cleanup: when cache exceeds limit, drop oldest entries (lowest turn number).
    if (_turnCache.size > MAX_TURN_CACHE_SIZE) {
        const entries = [..._turnCache.entries()].sort((a, b) => a[1].turn - b[1].turn);
        const toRemove = entries.slice(0, entries.length - MAX_TURN_CACHE_SIZE / 2);
        for (const [key] of toRemove) {
            _turnCache.delete(key);
        }
    }
}
/** Clear the turn-level cache (for testing / session reset). */
export function clearTurnCache() {
    _turnCache.clear();
    _turnCounter = 0;
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
    // Sort by keyword score, then by mtime (newer first) — Bug Fix #6: use precomputed mtimeMs
    return candidates
        .sort((a, b) => {
        if (b.score !== a.score)
            return b.score - a.score;
        // Tie-break by mtime — use precomputed mtimeMs if available
        let aTime = a.mtimeMs;
        let bTime = b.mtimeMs;
        if (aTime === undefined) {
            try {
                aTime = statSync(a.path).mtimeMs;
            }
            catch {
                aTime = 0;
            }
        }
        if (bTime === undefined) {
            try {
                bTime = statSync(b.path).mtimeMs;
            }
            catch {
                bTime = 0;
            }
        }
        return bTime - aTime;
    })
        .slice(0, topN);
}
// ── API ──
/**
 * Find the most relevant memory files for a given query.
 *
 * Uses embedding-based semantic matching when a provider is available;
 * falls back to keyword matching with a minimum score threshold.
 * Memories are NOT injected unless they genuinely match the current query.
 *
 * @param query - User query / conversation context
 * @param memoryDir - Path to the memory directory
 * @param _signal - AbortSignal for cancellation (unused in MVP)
 * @param _recentTools - Recently used tools for filtering (unused in MVP)
 * @param alreadySurfaced - Set of already-surfaced filenames to exclude
 * @param provider - Optional EmbeddingProvider for semantic matching
 */
export async function findRelevantMemories(query, memoryDir, _signal, _recentTools, alreadySurfaced, provider) {
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
    // Phase 2: Semantic/quality filter
    //   - Embedding available → cosine similarity ≥ threshold, score = keyword*0.3 + cosine*0.7
    //   - No embedding       → keyword score ≥ threshold
    let filtered;
    if (provider) {
        try {
            const queryEmb = await provider.embed(query);
            const texts = candidates.map((c) => `${c.name} ${c.description}`);
            const candidateEmbs = await provider.embedBatch(texts);
            filtered = [];
            for (let i = 0; i < candidates.length; i++) {
                const cos = cosineSimilarity(queryEmb, candidateEmbs[i]);
                if (cos >= MIN_COSINE_SIMILARITY) {
                    candidates[i].score = candidates[i].score * 0.3 + cos * 0.7;
                    filtered.push(candidates[i]);
                }
            }
        }
        catch {
            // Embedding failed → keyword threshold fallback
            filtered = candidates.filter((c) => c.score >= MIN_KEYWORD_SCORE);
        }
    }
    else {
        // No embedding provider → keyword threshold
        filtered = candidates.filter((c) => c.score >= MIN_KEYWORD_SCORE);
    }
    // No memories passed the relevance threshold → return empty (don't inject noise)
    if (filtered.length === 0) {
        _turnCache.set(cacheKey, { turn: _turnCounter, results: [] });
        return [];
    }
    // Phase 3: Rank by combined score + mtime, select Top-5
    const candidatesWithMtime = filtered.map((c) => ({ filename: c.filename, path: c.path, name: c.name, description: c.description, type: c.type, score: c.score, mtimeMs: statSync(c.path).mtimeMs }));
    const selected = selectTopMemories(candidatesWithMtime, 5);
    // Record hits on selected memories (M17)
    recordHits(selected.map((s) => s.filename), memoryDir);
    // Build result with staleness notes — reuse mtimeMs from selectTopMemories output
    const results = selected.map((s) => {
        const mtime = s.mtimeMs ?? 0;
        const c = filtered.find((cand) => cand.filename === s.filename);
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
    const final = alreadySurfaced && alreadySurfaced.size > 0
        ? nonNull.filter((r) => !alreadySurfaced.has(r.filename))
        : nonNull;
    // Cache for this turn
    _turnCache.set(cacheKey, { turn: _turnCounter, results: final });
    return final;
}
//# sourceMappingURL=memory-relevance.js.map