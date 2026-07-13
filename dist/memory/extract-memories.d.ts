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
/**
 * Initialize extract-memories (registers stopHook).
 * In the actual implementation, this would use the hooks system
 * to register a callback that fires after each complete query loop.
 */
export declare function initExtractMemories(): void;
/**
 * Check if new memories should be extracted.
 * Deduplicates against recent session-memory content.
 */
export declare function shouldExtractMemories(sessionId: string, projectRoot: string): boolean;
/**
 * Extract persistent memories from conversation transcript.
 * Returns structured memory entries for MEMORY.md storage.
 *
 * @param transcript - Full conversation transcript
 * @returns Array of { name, description, type, content } entries
 */
export declare function extractMemories(transcript: string): Array<{
    name: string;
    description: string;
    type: 'user' | 'feedback' | 'project' | 'reference';
    content: string;
}>;
/**
 * Format extracted memories as Markdown frontmatter + content.
 */
export declare function formatMemoryEntry(entry: {
    name: string;
    description: string;
    type: string;
    content: string;
}): string;
/**
 * Check and apply MEMORY.md capacity protection.
 */
export declare function checkMemoryCapacity(content: string): {
    content: string;
    truncated: boolean;
    warning?: string;
};
/** Update last extraction digest for dedup. */
export declare function updateExtractionDigest(digest: string): void;
//# sourceMappingURL=extract-memories.d.ts.map