/**
 * Context usage monitor — tracks token consumption and displays warnings.
 *
 * Phase 4.3
 */
import { estimateTokenCount } from '../chat/tokenizer.js';
import { getContextWindow } from './auto-compact.js';
// ── Stats ──
const _lastCompactionBySession = new Map();
export function recordCompaction(sessionId) {
    const ts = new Date().toISOString();
    if (sessionId) {
        _lastCompactionBySession.set(sessionId, ts);
    }
    else {
        // Legacy fallback: store under empty key
        _lastCompactionBySession.set('', ts);
    }
}
export function resetCompactionRecord(sessionId) {
    if (sessionId) {
        _lastCompactionBySession.delete(sessionId);
    }
    else {
        _lastCompactionBySession.clear();
    }
}
/**
 * Calculate context usage statistics.
 */
export function calculateContextStats(messages, model, sessionId) {
    const window = getContextWindow(model) || 128_000; // guard against 0 window
    const tokenCount = estimateTokenCount(messages, model);
    const total = tokenCount.total;
    const percentUsed = window > 0 ? (total / window) * 100 : 0;
    return {
        model,
        contextWindow: window,
        totalTokens: total,
        systemTokens: tokenCount.system,
        contextTokens: tokenCount.context,
        historyTokens: tokenCount.history,
        percentUsed: Math.round(percentUsed * 10) / 10,
        isWarning: percentUsed > 70,
        isCritical: percentUsed > 90,
        canCompact: messages.length >= 10,
        messageCount: messages.length,
        lastCompaction: _lastCompactionBySession.get(sessionId ?? '') || undefined,
    };
}
/**
 * Format context stats for display.
 */
export function formatContextStats(stats) {
    const lines = [];
    lines.push(`  Model:         ${stats.model} (${formatWindow(stats.contextWindow)})`);
    lines.push(`  System prompt: ${formatTokens(stats.systemTokens)}`);
    lines.push(`  Context:       ${formatTokens(stats.contextTokens)}`);
    lines.push(`  History:       ${formatTokens(stats.historyTokens)} (${stats.messageCount} messages)`);
    lines.push(`  Total used:    ${formatTokens(stats.totalTokens)} / ${formatTokens(stats.contextWindow)} (${stats.percentUsed}%)`);
    if (stats.lastCompaction) {
        lines.push(`  Last compact:  ${stats.lastCompaction.slice(0, 19)}`);
    }
    if (stats.isCritical) {
        lines.push(`  ⚠ CRITICAL: Context nearly full. Use /compact to free space.`);
    }
    else if (stats.isWarning) {
        lines.push(`  ⚡ Warning: Context usage above 70%. Consider /compact.`);
    }
    return lines.join('\n');
}
function formatTokens(n) {
    if (n >= 1000)
        return `${(n / 1000).toFixed(1)}K`;
    return String(n);
}
function formatWindow(n) {
    if (n >= 1_000_000)
        return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000)
        return `${(n / 1000).toFixed(1)}K`;
    return String(n);
}
//# sourceMappingURL=monitor.js.map