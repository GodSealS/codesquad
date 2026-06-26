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
// ── Factory Functions ──
/**
 * Create a cached section — computed once per session.
 */
export function systemPromptSection(name, compute) {
    return { name, compute, cacheBreak: false };
}
/**
 * Create an uncached section — recomputed every turn.
 * Must provide a reason why it can't be cached.
 */
export function uncachedSystemPromptSection(name, compute, reason) {
    return { name, compute, cacheBreak: true, reason };
}
// ── Cache ──
const sectionCache = new Map();
/**
 * Resolve all sections, using cache where applicable.
 * Static sections (cacheBreak=false) return cached values.
 * Dynamic sections (cacheBreak=true) recompute every time.
 */
export async function resolveSystemPromptSections(sections, context) {
    const staticPrompts = [];
    const dynamicPrompts = [];
    for (const section of sections) {
        if (!section.cacheBreak && sectionCache.has(section.name)) {
            const cached = sectionCache.get(section.name);
            if (cached)
                staticPrompts.push(cached);
            continue;
        }
        const result = await section.compute(context);
        if (!result)
            continue;
        if (!section.cacheBreak) {
            sectionCache.set(section.name, result);
            staticPrompts.push(result);
        }
        else {
            dynamicPrompts.push(result);
        }
    }
    return { staticPrompts, dynamicPrompts };
}
/**
 * Clear the section cache (called on /clear or /compact).
 */
export function clearSystemPromptSections() {
    sectionCache.clear();
}
/**
 * Invalidate a specific section from cache.
 */
export function invalidateSection(name) {
    sectionCache.delete(name);
}
//# sourceMappingURL=sections.js.map