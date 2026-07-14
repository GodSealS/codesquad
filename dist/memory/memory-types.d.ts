/**
 * Memory Type System — defines 4 memory types and corresponding system prompt sections.
 *
 * References:
 *   Claude Code src/memdir/memoryTypes.ts
 *   Idea/tutrue/memory-system-design.md §2.3.1
 */
/** 4 standard memory types (aligned with Claude Code). */
export declare const MEMORY_TYPES: readonly ["user", "feedback", "project", "reference"];
export type MemoryType = typeof MEMORY_TYPES[number];
/** Individual mode: type taxonomy section injected into system prompt. */
export declare const TYPES_SECTION_INDIVIDUAL: string;
/** Combined (team) mode type section. */
export declare const TYPES_SECTION_COMBINED: string;
/** What NOT to save — prevents memory pollution. */
export declare const WHAT_NOT_TO_SAVE_SECTION: string;
/** When to access memory rules. */
export declare const WHEN_TO_ACCESS_SECTION: string;
/** Trust-but-verify recall guidance. */
export declare const TRUSTING_RECALL_SECTION: string;
/** Frontmatter example for memory files. */
export declare const MEMORY_FRONTMATTER_EXAMPLE: string;
/** Memory drift caveat — warns about stale memories. */
export declare const MEMORY_DRIFT_CAVEAT: string;
/** Memory system capabilities — explains runtime memory features to the agent. */
export declare const MEMORY_SYSTEM_CAPABILITIES: string;
//# sourceMappingURL=memory-types.d.ts.map