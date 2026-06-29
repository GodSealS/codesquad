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
// S05 note: these globals will be removed in S05 when migrated to Session.turnCount.
let _currentTurn = 0; // fallback for callers without sessionId
const _currentTurnBySession = new Map();
const _lastCompactTurnBySession = new Map();
/** S04: circuit breaker — track consecutive compact failures per session. */
const _compactFailures = new Map();
const MAX_CONSECUTIVE_COMPACT_FAILURES = 3;
/** S04: recursive marker — prevents compact from triggering compact internally. */
const _compactingSessions = new Set();
/** Clean up stale session tracking entries (call periodically or on session close). */
export function cleanupSessionTracking(sessionId) {
    if (sessionId) {
        _currentTurnBySession.delete(sessionId);
        _lastCompactTurnBySession.delete(sessionId);
        _compactFailures.delete(sessionId);
        _compactingSessions.delete(sessionId);
    }
    else {
        _currentTurnBySession.clear();
        _lastCompactTurnBySession.clear();
        _compactFailures.clear();
        _compactingSessions.clear();
        _currentTurn = 0;
    }
}
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
export function shouldAutoCompact(messages, model, sessionOrId) {
    const sessionId = typeof sessionOrId === 'string' ? sessionOrId : sessionOrId?.id;
    const session = typeof sessionOrId === 'object' ? sessionOrId : undefined;
    // S04: recursion guard — compact must never trigger another compact.
    if (sessionId && _compactingSessions.has(sessionId)) {
        return { should: false, tokenUsage: 0, thresholdTokens: 0, percentUsed: 0 };
    }
    // S04: circuit breaker — skip if we've failed too many times consecutively.
    if (sessionId) {
        const failures = _compactFailures.get(sessionId) ?? 0;
        if (failures >= MAX_CONSECUTIVE_COMPACT_FAILURES) {
            return { should: false, tokenUsage: 0, thresholdTokens: 0, percentUsed: 0 };
        }
    }
    const window = getContextWindow(model);
    const thresholdTokens = Math.floor(window * AUTO_COMPACT_THRESHOLD);
    const tokenCount = estimateTokenCount(messages, model).total;
    const percentUsed = (tokenCount / window) * 100;
    // S05: prefer session.turnCount over global Map
    const currentTurn = session?.turnCount
        ?? (sessionId ? (_currentTurnBySession.get(sessionId) ?? 0) : _currentTurn);
    const lastCompactTurn = session?.lastCompactTurn
        ?? (sessionId ? (_lastCompactTurnBySession.get(sessionId) ?? 0) : 0);
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
    const sessionId = session.id;
    const check = shouldAutoCompact(messages, model, session);
    if (!check.should)
        return null;
    // S04: set recursion guard — prevent compact from triggering compact
    if (sessionId)
        _compactingSessions.add(sessionId);
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
        if (sessionId) {
            // S05: store in session object, with Map fallback for legacy callers
            session.lastCompactTurn = session.turnCount;
            _lastCompactTurnBySession.set(sessionId, session.turnCount);
            // S04: reset circuit breaker on success
            _compactFailures.set(sessionId, 0);
        }
        return result;
    }
    catch (err) {
        // S04: increment circuit breaker on failure
        if (sessionId) {
            const failures = (_compactFailures.get(sessionId) ?? 0) + 1;
            _compactFailures.set(sessionId, failures);
        }
        // Timeout or LLM failure → compact failed, notify caller via exception type
        const isTimeout = err.message === 'COMPACT_TIMEOUT';
        throw new Error(isTimeout ? 'COMPACT_TIMEOUT' : `COMPACT_FAILED: ${err.message}`);
    }
    finally {
        // S04: clear recursion guard
        if (sessionId)
            _compactingSessions.delete(sessionId);
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
/** Increment turn counter. Call at the start of each sendToAgent().
 * S05: prefers session.turnCount (per-session), falls back to global Map. */
export function incrementTurn(session) {
    if (session) {
        session.turnCount = (session.turnCount ?? 0) + 1;
        return true;
    }
    // Legacy fallback for callers without session object
    _currentTurn++;
    return true;
}
/** Reset compaction tracking (on /new or /clear). */
export function resetCompactTracking(session) {
    if (session) {
        session.lastCompactTurn = 0;
        _compactFailures.delete(session.id);
        _compactingSessions.delete(session.id);
        return true;
    }
    // Legacy fallback
    _lastCompactTurnBySession.clear();
    _currentTurnBySession.clear();
    _currentTurn = 0;
    return true;
}
// ── Helpers ──
function getContextWindow(model) {
    // Exact match (case-sensitive)
    if (MODEL_CONTEXT_WINDOWS[model])
        return MODEL_CONTEXT_WINDOWS[model];
    // Case-insensitive exact match
    const lowerModel = model.toLowerCase();
    for (const [key, value] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
        if (key.toLowerCase() === lowerModel)
            return value;
    }
    // Prefix match (case-insensitive, e.g. "claude-sonnet-4-20250514-variant")
    for (const [key, value] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
        if (lowerModel.startsWith(key.toLowerCase()))
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