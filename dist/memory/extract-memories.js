/**
 * Persistent Memory Extraction — extracts durable memories from conversations.
 *
 * Separate from session-memory (which produces transient conversation notes).
 * This module persists memories into MEMORY.md + topic files for cross-session use.
 *
 * Trigger: end of each complete query loop (LLM responds without tool calls).
 * Uses stopHook registration pattern.
 *
 * References:
 *   Claude Code src/services/extractMemories/extractMemories.ts
 *   Idea/tutrue/memory-system-design.md §2.3.5
 */
import { readSessionMemory } from './session-memory.js';
import { truncateEntrypointContent } from './workspace-memory.js';
// ── State ──
let _stopHookRegistered = false;
let _lastExtractedDigest = '';
// ── API ──
/**
 * Initialize extract-memories (registers stopHook).
 * In the actual implementation, this would use the hooks system
 * to register a callback that fires after each complete query loop.
 */
export function initExtractMemories() {
    if (_stopHookRegistered)
        return;
    _stopHookRegistered = true;
    // Hook registration will be wired up in agent-runner integration (M7)
}
/**
 * Check if new memories should be extracted.
 * Deduplicates against recent session-memory content.
 */
export function shouldExtractMemories(sessionId, projectRoot) {
    if (!_stopHookRegistered)
        return false;
    // Check session-memory dedup
    const sessionMem = readSessionMemory(sessionId, projectRoot);
    if (!sessionMem)
        return true; // No session-memory yet → extract freely
    // Bug Fix #4: Compare content digest (first 500 chars, whitespace-normalized),
    // keyed by sessionId to prevent cross-session false positives.
    const digest = `${sessionId}::${sessionMem.slice(0, 500).replace(/\s+/g, ' ')}`;
    if (digest === _lastExtractedDigest)
        return false;
    return true;
}
/**
 * Extract persistent memories from conversation transcript.
 * Returns structured memory entries for MEMORY.md storage.
 *
 * @param transcript - Full conversation transcript
 * @returns Array of { name, description, type, content } entries
 */
export function extractMemories(transcript, sessionId, projectRoot) {
    // Bug Fix #6: Implement basic keyword-based extraction instead of returning empty
    const results = [];
    // Extract problem-solving insights from transcript.
    // Focus: root cause, design rationale, fix technique, lessons — not surface statements.
    const lines = transcript.split('\n');
    const patterns = [
        // ── Root cause analysis: the "why" behind bugs and unexpected behavior ──
        { re: /根因[是为]?[：:]\s*(.+)/i, type: 'project', prefix: 'RootCause: ' },
        { re: /root\s*cause[：:]*\s*(.+)/i, type: 'project', prefix: 'RootCause: ' },
        { re: /(.+)是根[本]?原因/i, type: 'project', prefix: 'RootCause: ' },
        // ── Design rationale: architecture decisions with reasoning ──
        { re: /设计思路[：:]\s*(.+)/i, type: 'project', prefix: 'DesignRationale: ' },
        { re: /设计[上中]?因为(.+)/i, type: 'project', prefix: 'DesignRationale: ' },
        { re: /选择(.+)因为(.+)/i, type: 'project', prefix: 'DesignRationale: ' },
        { re: /trade[-\s]?off[：:]*\s*(.+)/i, type: 'project', prefix: 'DesignRationale: ' },
        // ── Fix technique: HOW (not just WHAT was fixed) ──
        { re: /修复(?:方式|技巧|方法)[：:]\s*(.+)/i, type: 'project', prefix: 'FixTechnique: ' },
        { re: /解决方案[：:]\s*(.+)/i, type: 'project', prefix: 'FixTechnique: ' },
        { re: /workaround[：:]*\s*(.+)/i, type: 'project', prefix: 'FixTechnique: ' },
        { re: /绕过(.+?)限制/i, type: 'project', prefix: 'FixTechnique: ' },
        // ── Lessons learned: reusable warnings and anti-patterns ──
        { re: /教训[：:]\s*(.+)/i, type: 'feedback', prefix: 'Lesson: ' },
        { re: /lesson\s*learned[：:]*\s*(.+)/i, type: 'feedback', prefix: 'Lesson: ' },
        { re: /下次[应要不该][^。.]*/i, type: 'feedback', prefix: 'Lesson: ' },
        // ── Key constraints: hard limits that future decisions must respect ──
        { re: /关键限制[：:]\s*(.+)/i, type: 'project', prefix: 'Constraint: ' },
        { re: /hard\s*requirement[：:]*\s*(.+)/i, type: 'project', prefix: 'Constraint: ' },
        { re: /不能改动(.+)/i, type: 'project', prefix: 'Constraint: ' },
        // ── User preference: coding style / tool choices (only when explicit) ──
        { re: /偏好[：:]\s*(.+)/i, type: 'user', prefix: 'Preference: ' },
        { re: /习惯用(.+)/i, type: 'user', prefix: 'Preference: ' },
    ];
    // Quality gates
    const MIN_INSIGHT_LENGTH = 15; // reject noise like "根因：好的"
    const CONTEXT_LINES = 2; // surrounding lines to capture for context
    let idx = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        for (const pat of patterns) {
            const match = trimmed.match(pat.re);
            if (!match)
                continue;
            // Extract the first meaningful capture group
            let value = '';
            for (let g = 1; g < match.length; g++) {
                const v = match[g]?.trim();
                if (v && v.length > 0) {
                    value = v;
                    break;
                }
            }
            if (!value)
                continue;
            // Quality gate: reject generic / noise matches
            if (value.length < MIN_INSIGHT_LENGTH)
                continue;
            if (/^(?:好[的]?|嗯|ok|yes|no|对|了解|明白|收到)[!！。.]?$/i.test(value))
                continue;
            // Enrich with surrounding context for self-contained memory
            const start = Math.max(0, i - CONTEXT_LINES);
            const end = Math.min(lines.length, i + CONTEXT_LINES + 1);
            const context = lines.slice(start, end)
                .map((l, ci) => `${start + ci === i ? '>' : ' '} ${l}`)
                .join('\n');
            // Use sessionId prefix to avoid collision across parallel sessions
            const sessionPrefix = (sessionId ?? 'nosession').slice(0, 8);
            results.push({
                name: `mem-${sessionPrefix}-${Date.now()}-${idx++}`,
                description: `${pat.prefix}${value}`,
                type: pat.type,
                content: [
                    'From conversation transcript:',
                    '',
                    '```',
                    context,
                    '```',
                    '',
                    `**Key insight**: ${value}`,
                ].join('\n'),
            });
        }
    }
    // Bug Fix #4: Update digest based on session-memory content, keyed by sessionId
    // (same format as shouldExtractMemories compares against).
    // Include sessionId prefix to prevent cross-session false positives
    // when multiple runAgent calls share the module-level _lastExtractedDigest.
    if (sessionId && projectRoot) {
        const sessionMem = readSessionMemory(sessionId, projectRoot);
        if (sessionMem) {
            _lastExtractedDigest = `${sessionId}::${sessionMem.slice(0, 500).replace(/\s+/g, ' ')}`;
        }
    }
    return results;
}
/**
 * Format extracted memories as Markdown frontmatter + content.
 */
export function formatMemoryEntry(entry) {
    const today = new Date().toISOString().slice(0, 10);
    return [
        '---',
        `name: "${entry.name}"`,
        `description: "${entry.description}"`,
        `type: ${entry.type}`,
        `created: ${today}`,
        `updated: ${today}`,
        '---',
        '',
        entry.content,
    ].join('\n');
}
/**
 * Check and apply MEMORY.md capacity protection.
 */
export function checkMemoryCapacity(content) {
    return truncateEntrypointContent(content);
}
/** Update last extraction digest for dedup. */
export function updateExtractionDigest(digest) {
    _lastExtractedDigest = digest;
}
//# sourceMappingURL=extract-memories.js.map