/**
 * Cross-chat memory summarizer.
 *
 * When a new session is created, extracts key context from recent
 * historical sessions and formats it as an injected system message.
 * Mitigates the "new chat loses history" problem for LLM context windows.
 *
 * Phase 8.2-8.3. Step 7: semantic cross-session retrieval.
 */
import { listSessions, load } from '../chat/session.js';
import { getVectorStore } from '../embedding/store.js';
import { getEmbeddingProvider, isSemanticEnabled } from '../embedding/provider.js';
// ── Summarize ──
/**
 * Extract summaries from the most recent N historical sessions.
 *
 * If `userInput` is provided and semantic context is enabled, uses
 * embedding-based cross-session retrieval to find semantically relevant
 * messages from past sessions. Otherwise falls back to time-based recency.
 *
 * Excludes the session identified by `excludeId` (the currently active session).
 *
 * @param limit Maximum number of sessions to include
 * @param excludeId Current session ID to exclude
 * @param userInput Optional user input for semantic matching
 * @returns HistorySummary or null if no relevant sessions found
 */
export async function summarizeHistory(limit, excludeId, userInput) {
    // Step 7: semantic cross-session retrieval
    if (userInput && isSemanticEnabled()) {
        const provider = await getEmbeddingProvider();
        if (provider) {
            return semanticHistoryRetrieval(userInput, limit, excludeId);
        }
    }
    // Fallback to time-based recency (original behavior)
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
// ── Semantic History Retrieval (Step 7) ──
/**
 * Use embedding similarity to find semantically relevant messages
 * from historical sessions, across all stored embeddings.
 *
 * Algorithm:
 * 1. Embed userInput
 * 2. Search VectorStore across all sessions (excluding current)
 * 3. Group results by session, score by best match
 * 4. Return top-N sessions with their matching message summaries
 */
async function semanticHistoryRetrieval(userInput, limit, excludeId) {
    const provider = await getEmbeddingProvider();
    if (!provider)
        return null;
    const inputEmbedding = await provider.embed(userInput);
    const store = getVectorStore();
    // Get all known session IDs from VectorStore
    const allSessionIds = store.listSessions();
    // Exclude current session
    const candidateIds = excludeId
        ? allSessionIds.filter(id => id !== excludeId)
        : allSessionIds;
    if (candidateIds.length === 0)
        return null;
    // 🔧 Bug Fix: listSessions() 移到循环外部，避免重复 I/O
    const allSessions = await listSessions();
    // Search each session for relevant messages
    const matches = [];
    for (const sessionId of candidateIds.slice(0, 50)) {
        // 🔧 Bug Fix: 排除 ephemeral session（fork-/agent- 前缀）
        if (sessionId.startsWith('fork-') || sessionId.startsWith('agent-'))
            continue;
        const msgs = store.searchBySession(sessionId, inputEmbedding, 0.5);
        if (msgs.length > 0) {
            // Use best match score as session relevance
            const bestMatch = msgs[0];
            const content = msgs
                .slice(0, 3)
                .map(m => `[${m.role}] ${m.summary || m.content.slice(0, 100)}`)
                .join(' | ');
            const meta = allSessions.find(s => s.id === sessionId);
            if (meta) {
                matches.push({
                    session: meta,
                    score: bestMatch.similarity,
                    content,
                });
            }
        }
    }
    if (matches.length === 0)
        return null;
    // Sort by relevance score descending, take top-N
    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, limit);
    return {
        generatedAt: new Date().toISOString(),
        sessionCount: topMatches.length,
        sessions: topMatches.map(m => ({
            agent: m.session.agent,
            name: m.session.name,
            updatedAt: m.session.updatedAt,
            summary: `[语义匹配度: ${(m.score * 100).toFixed(0)}%]\n${m.content}`,
        })),
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