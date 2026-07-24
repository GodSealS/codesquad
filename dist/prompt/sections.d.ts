/**
 * System Prompt Section Factory — aligned with Claude Code's systemPromptSection pattern.
 *
 * References:
 *   Claude Code src/constants/systemPromptSections.ts
 *   Claude Code src/constants/prompts.ts — getSystemPrompt()
 *
 * Each section has: name, compute function, cacheBreak flag.
 * Sections with cacheBreak=false are computed once and cached until /clear or /compact.
 * Sections with cacheBreak=true are recomputed every turn.
 *
 * Phase 3.0
 */
export interface SystemPromptSection {
    name: string;
    compute: (context: PromptSectionContext) => Promise<string | null>;
    cacheBreak: boolean;
    /** Why cacheBreak=true is needed (documentation). */
    reason?: string;
}
export interface PromptSectionContext {
    agentName: string;
    model: string;
    cwd: string;
    projectRoot: string;
    sessionId?: string;
    /** UI language: "zh" | "en". Used to determine response language. */
    lang?: string;
    /** Current session message count. Cross-session sections should yield when this is high. */
    messageCount?: number;
}
/**
 * Create a cached section — computed once per session.
 */
export declare function systemPromptSection(name: string, compute: (context: PromptSectionContext) => Promise<string | null>): SystemPromptSection;
/**
 * Create an uncached section — recomputed every turn.
 * Must provide a reason why it can't be cached.
 */
export declare function uncachedSystemPromptSection(name: string, compute: (context: PromptSectionContext) => Promise<string | null>, reason: string): SystemPromptSection;
/**
 * Resolve all sections, using cache where applicable.
 * Static sections (cacheBreak=false) return cached values.
 * Dynamic sections (cacheBreak=true) recompute every time.
 */
export declare function resolveSystemPromptSections(sections: SystemPromptSection[], context: PromptSectionContext): Promise<{
    staticPrompts: string[];
    dynamicPrompts: string[];
}>;
/**
 * Clear the section cache (called on /clear or /compact).
 */
export declare function clearSystemPromptSections(): void;
/**
 * Invalidate a specific section from cache.
 */
export declare function invalidateSection(name: string): void;
//# sourceMappingURL=sections.d.ts.map