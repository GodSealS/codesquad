/**
 * Memory Tag System — domain classification + context-aware tag matching.
 *
 * Design principle: memories are classified by domain tags. Current conversation
 * context determines which tags are relevant, and only compressed summaries
 * of matching memories are injected. Full content is retrieved on-demand.
 *
 * Tag taxonomy is loaded from Config/memory-tags.yaml (runtime-editable).
 * A built-in fallback is used if the config file is missing.
 */
/** A single domain tag definition from the config file. */
export interface TagDef {
    name: string;
    keywords: string[];
}
/** The full tags configuration structure. */
export interface TagsConfig {
    version: number;
    tags: Record<string, TagDef>;
}
/** Domain tag identifier (config-driven, any string key from the config). */
export type DomainTag = string;
/** Get the loaded tags (config or fallback). */
export declare function getTagsConfig(): TagsConfig;
/** Reset cached config (for testing / hot-reload). */
export declare function resetTagsConfig(): void;
export declare function resetNameLookup(): void;
/** All domain tag keys. */
export declare function allDomainTags(): string[];
/**
 * Match conversation context to domain tags.
 * Returns tags ordered by relevance score (highest first).
 */
export declare function matchContextTags(query: string, agentName?: string, recentTools?: string[]): Array<{
    tag: string;
    name: string;
    score: number;
}>;
/**
 * Convert user-defined tag strings (from frontmatter `tags` field) to tag keys.
 * Accepts both Chinese names and English keys.
 */
export declare function resolveTags(tagStrings: string[]): string[];
/**
 * Get the display name for a domain tag.
 */
export declare function getTagName(tag: string): string;
/**
 * Build a compressed memory summary line for context injection.
 * Format: `[设计] Memory Name — one-line description`
 */
export declare function formatCompressedMemory(name: string, description: string, tags: string[]): string;
/**
 * Build the compressed memory block for context injection.
 * Only includes tag + name + description, NOT full content.
 */
export declare function buildCompressedMemoryBlock(memories: Array<{
    name: string;
    description: string;
    tags?: string[];
    tagKeys?: string[];
}>): string;
//# sourceMappingURL=memory-tags.d.ts.map