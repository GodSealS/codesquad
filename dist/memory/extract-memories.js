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
    // Simple dedup: skip if session-memory hasn't changed significantly
    if (sessionMem === _lastExtractedDigest)
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
export function extractMemories(transcript) {
    // Placeholder — in full implementation, this calls an LLM
    // to identify durable insights from the transcript.
    // For MVP, returns an empty array (handled by caller).
    void transcript;
    return [];
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