/**
 * Cross-chat memory summarizer.
 *
 * When a new session is created, extracts key context from recent
 * historical sessions and formats it as an injected system message.
 * Mitigates the "new chat loses history" problem for LLM context windows.
 *
 * Phase 8.2-8.3.
 */
import { listSessions, load } from '../chat/session.js';
// ── Summarize ──
/**
 * Extract summaries from the most recent N historical sessions.
 * Excludes the session identified by `excludeId` (the currently active session).
 * Each session contributes its last 3 assistant messages (first 200 chars each,
 * truncated at nearest word boundary).
 *
 * Returns null if there are no historical sessions to summarize.
 */
export async function summarizeHistory(limit, excludeId) {
    const allSessions = await listSessions();
    // Exclude the current session (by ID, not status — status may never change).
    // listSessions() already returns sessions sorted by updatedAt descending.
    const candidates = excludeId
        ? allSessions.filter((s) => s.id !== excludeId)
        : allSessions;
    const recent = candidates.slice(0, limit);
    if (recent.length === 0)
        return null;
    const sessions = [];
    for (const meta of recent) {
        const full = await load(meta.id);
        if (!full)
            continue;
        const lastAssistantMsgs = full.messages
            .filter((m) => m.role === 'assistant')
            .slice(-3);
        const summary = lastAssistantMsgs
            .map((m) => truncate(m.content.trim(), 200))
            .filter(Boolean)
            .join('\n\n---\n\n');
        if (!summary)
            continue;
        sessions.push({
            agent: meta.agent,
            name: meta.name,
            updatedAt: meta.updatedAt,
            summary,
        });
    }
    if (sessions.length === 0)
        return null;
    return {
        generatedAt: new Date().toISOString(),
        sessionCount: sessions.length,
        sessions,
    };
}
/**
 * Truncate text to maxLen characters, cutting at the nearest word boundary.
 */
function truncate(text, maxLen) {
    if (text.length <= maxLen)
        return text;
    const cut = text.lastIndexOf(' ', maxLen);
    return (cut > maxLen / 2 ? text.slice(0, cut) : text.slice(0, maxLen)) + '...';
}
// ── Format ──
/**
 * Format a HistorySummary as a Markdown text block suitable for
 * injection into the system prompt or context.
 */
export function formatHistorySummary(summary) {
    const lines = [
        `[跨 Chat 记忆] 以下是最新 ${summary.sessionCount} 个历史会话的关键结论（生成时间: ${summary.generatedAt.slice(0, 19)}）：`,
        '',
    ];
    for (const s of summary.sessions) {
        lines.push(`### ${s.agent}: ${s.name}`);
        lines.push(`_${s.updatedAt.slice(0, 10)}_`);
        lines.push('');
        lines.push(s.summary);
        lines.push('');
        lines.push('---');
        lines.push('');
    }
    lines.push('[跨 Chat 记忆结束]');
    return lines.join('\n');
}
//# sourceMappingURL=memory-summarizer.js.map