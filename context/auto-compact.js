/**
 * Auto-compact trigger — monitors token usage and triggers compaction.
 *
 * References:
 *   Claude Code src/services/compact/autoCompact.ts
 *
 * Phase 4.1
 */
import { estimateTokenCount } from '../chat/tokenizer.js';
import { compactConversation } from './compact.js';
import { getDiskCache } from '../cache/disk-cache.js';
import { successResult, errorResult } from '../core/task-result.js';
// ── Constants ──
/** Token usage threshold triggering auto-compact (as fraction of context window). */
const AUTO_COMPACT_THRESHOLD = 0.85;
/** Minimum messages before auto-compact can trigger. */
const AUTO_COMPACT_MIN_MESSAGES = 10;
/** Minimum turns since last compaction (per-session, to avoid cross-session contamination). */
let _currentTurn = 0; // fallback for callers without sessionId
const _currentTurnBySession = new Map();
const _lastCompactTurnBySession = new Map();
// ── Model Context Windows ──
const MODEL_CONTEXT_WINDOWS = {
    'claude-sonnet-4-20250514': 200_000,
    'claude-opus-4-20250514': 200_000,
    'claude-haiku-3-5': 200_000,
    'gpt-4o': 128_000,
    'gpt-4o-mini': 128_000,
    'gpt-4-turbo': 128_000,
    'deepseek-chat': 128_000,
    'deepseek-coder': 128_000,
    'deepseek-reasoner': 128_000,
    'deepseek-v4-flash': 1_000_000,
    'deepseek-v4-pro': 1_000_000,
    'deepseek-v4-pro-202606': 1_000_000,
    'kimi-k2-7': 128_000,
    'kimi-k2.6': 128_000,
    'glm-5-1': 128_000,
    'glm-5': 128_000,
    'glm-5v-turbo': 128_000,
    'qwen': 131_072,
    'qwen3': 131_072,
    'minimax-m3': 256_000,
};
const DEFAULT_CONTEXT_WINDOW = 128_000;
// ── Public API ──
/**
 * Check if auto-compaction should be triggered.
 * Called before each sendToAgent() call.
 */
export function shouldAutoCompact(messages, model, sessionId) {
    const window = getContextWindow(model);
    const thresholdTokens = Math.floor(window * AUTO_COMPACT_THRESHOLD);
    const tokenCount = estimateTokenCount(messages, model).total;
    const percentUsed = (tokenCount / window) * 100;
    const currentTurn = sessionId ? (_currentTurnBySession.get(sessionId) ?? 0) : _currentTurn;
    const lastCompactTurn = sessionId ? (_lastCompactTurnBySession.get(sessionId) ?? 0) : 0;
    const should = tokenCount >= thresholdTokens &&
        messages.length >= AUTO_COMPACT_MIN_MESSAGES &&
        (currentTurn - lastCompactTurn) >= 3;
    return { should, tokenUsage: tokenCount, thresholdTokens, percentUsed };
}
/**
 * Check and optionally auto-compact.
 * Returns compact result if compaction was performed, null otherwise.
 */
export async function autoCompact(messages, session, model, callLLM, onWarning) {
    const check = shouldAutoCompact(messages, model);
    if (!check.should)
        return null;
    // Notify user
    if (onWarning) {
        onWarning(check.percentUsed);
    }
    // Pre-read DiskCache for cached file summaries
    const cachedSummaries = await buildCacheContextForCompact();
    const compactOptions = {
        model,
        maxOutputTokens: 4096,
        ...(cachedSummaries ? { customInstructions: cachedSummaries } : {}),
    };
    // P0 fix: 30s timeout protection — prevents compact from hanging forever.
    const COMPACT_TIMEOUT_MS = 30_000;
    let timeoutId;
    try {
        const compactPromise = compactConversation(messages, session, compactOptions, callLLM);
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('COMPACT_TIMEOUT')), COMPACT_TIMEOUT_MS);
        });
        const result = await Promise.race([compactPromise, timeoutPromise]);
        if (session.id) {
            const turnForSession = _currentTurnBySession.get(session.id) ?? _currentTurn;
            _lastCompactTurnBySession.set(session.id, turnForSession);
        }
        return result;
    }
    catch (err) {
        // Timeout or LLM failure → compact failed, notify caller via exception type
        const isTimeout = err.message === 'COMPACT_TIMEOUT';
        throw new Error(isTimeout ? 'COMPACT_TIMEOUT' : `COMPACT_FAILED: ${err.message}`);
    }
    finally {
        if (timeoutId)
            clearTimeout(timeoutId);
    }
}
/**
 * P3: TaskResult-wrapped version of autoCompact.
 * Returns structured result instead of throwing on failure.
 */
export async function autoCompactWithResult(messages, session, model, callLLM, onWarning) {
    const startMs = Date.now();
    try {
        const result = await autoCompact(messages, session, model, callLLM, onWarning);
        return successResult(result, { durationMs: Date.now() - startMs });
    }
    catch (err) {
        const msg = err.message;
        const errorCode = msg.includes('COMPACT_TIMEOUT') ? 'COMPACT_TIMEOUT' : 'COMPACT_FAILED';
        return errorResult({ errorCode, message: msg, durationMs: Date.now() - startMs });
    }
}
/** Increment turn counter. Call at the start of each sendToAgent(). */
export function incrementTurn(sessionId) {
    _currentTurn++; // global fallback (backward compat)
    if (sessionId) {
        const prev = _currentTurnBySession.get(sessionId) ?? 0;
        _currentTurnBySession.set(sessionId, prev + 1);
    }
    return true;
}
/** Reset compaction tracking (on /new or /clear). */
export function resetCompactTracking(sessionId) {
    if (sessionId) {
        _lastCompactTurnBySession.delete(sessionId);
        _currentTurnBySession.delete(sessionId);
    }
    else {
        _lastCompactTurnBySession.clear();
        _currentTurnBySession.clear();
    }
    _currentTurn = 0;
    return true;
}
// ── Helpers ──
function getContextWindow(model) {
    // Exact match
    if (MODEL_CONTEXT_WINDOWS[model])
        return MODEL_CONTEXT_WINDOWS[model];
    // Prefix match (e.g. "claude-sonnet-4-20250514-variant")
    for (const [key, value] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
        if (model.startsWith(key))
            return value;
    }
    return DEFAULT_CONTEXT_WINDOW;
}
/**
 * Build cache context for compact prompt.
 * Reads DiskCache to get a list of recently cached files.
 */
async function buildCacheContextForCompact() {
    const dc = getDiskCache();
    if (!dc)
        return null;
    try {
        const stats = await dc.stats();
        if (stats.totalEntries === 0)
            return null;
        const { readManifest } = await import('../cache/manifest.js');
        const manifest = await readManifest(stats.cacheDir);
        if (manifest.entries.length === 0)
            return null;
        // Top 20 most recently accessed files
        const recent = [...manifest.entries]
            .sort((a, b) => b.accessedAt - a.accessedAt)
            .slice(0, 20);
        const lines = ['## Cached Files in This Project', ''];
        for (const entry of recent) {
            const date = new Date(entry.accessedAt).toISOString().slice(0, 16);
            lines.push(`- ${entry.filePath} (${(entry.sizeBytes / 1024).toFixed(0)} KB, read ${date})`);
        }
        lines.push('');
        lines.push('Use these file summaries as context when compacting the conversation.');
        return lines.join('\n');
    }
    catch {
        return null;
    }
}
export { getContextWindow };
//# sourceMappingURL=auto-compact.js.map