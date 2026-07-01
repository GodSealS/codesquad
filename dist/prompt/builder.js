/**
 * System Prompt Builder — priority chain + assembly.
 *
 * References:
 *   Claude Code src/utils/systemPrompt.ts — buildEffectiveSystemPrompt()
 *
 * Priority chain (high to low):
 *   1. overrideSystemPrompt   — --system-prompt CLI arg
 *   2. agentSystemPrompt       — @agent-name loaded prompt
 *   3. customSystemPrompt      — user configured
 *   4. defaultSystemPrompt     — standard sections assembly
 *   5. appendSystemPrompt      — always appended (.codesquad/CODESQUAD.md, etc.)
 *
 * Phase 3.2
 */
import { resolveSystemPromptSections, clearSystemPromptSections as clearCache } from './sections.js';
import { getDefaultSections } from './builtin-sections.js';
// S10: cross-turn cache — avoid rebuilding static parts every loop iteration.
const _staticCache = new Map();
// ── Builder ──
/**
 * Build the effective system prompt.
 * Returns an array of prompt strings (will be joined with double-newline for API).
 */
export async function buildEffectiveSystemPrompt(options) {
    const { overrideSystemPrompt, agentSystemPrompt, customSystemPrompt, appendSystemPrompt = [], context, extraSections = [], } = options;
    // Priority 0: override
    if (overrideSystemPrompt) {
        const prompts = Array.isArray(overrideSystemPrompt)
            ? overrideSystemPrompt
            : [overrideSystemPrompt];
        return [...prompts, ...appendSystemPrompt];
    }
    // Priority 1-3: resolve sections
    let mainPrompts;
    if (agentSystemPrompt) {
        // Priority 1: Agent prompt replaces everything
        mainPrompts = [agentSystemPrompt];
    }
    else if (customSystemPrompt) {
        // Priority 2: Custom prompt replaces default
        mainPrompts = [customSystemPrompt];
    }
    else {
        // Priority 3: Default sections
        const sections = [...getDefaultSections(), ...extraSections];
        const { staticPrompts, dynamicPrompts } = await resolveSystemPromptSections(sections, context);
        mainPrompts = [...staticPrompts, ...dynamicPrompts];
    }
    // Append: always added at the end
    return [...mainPrompts, ...appendSystemPrompt];
}
/**
 * Build system prompt specifically for agent conversation.
 * Includes: project guidance + agent prompt + mode prompt + skill guidance + tool guidance.
 *
 * Feature 4 (P4 Prompt Caching): Returns separated static/dynamic parts for cache_control.
 * Static parts can be cached by Anthropic API; dynamic parts are recomputed each turn.
 */
export async function buildAgentSystemPrompt(agentPrompt, context, extraPrompts = []) {
    return buildAgentSystemPromptSeparated(agentPrompt, context, extraPrompts).then((r) => [...r.staticParts, ...r.dynamicParts]);
}
/**
 * Build system prompt with separation of cacheable static vs. uncached dynamic parts.
 * Feature 4 (P4): Enables Anthropic prompt caching for static sections.
 */
export async function buildAgentSystemPromptSeparated(agentPrompt, context, extraPrompts = []) {
    // S10: cache key = sessionId + agentName (agentPrompt can change mid-session)
    const cacheKey = context.sessionId ? `${context.sessionId}:${context.agentName}` : undefined;
    const cached = cacheKey ? _staticCache.get(cacheKey) : undefined;
    if (cached && cached.model === context.model) {
        return {
            staticParts: cached.parts,
            dynamicParts: extraPrompts,
        };
    }
    const sections = [
        ...getDefaultSections(),
    ];
    const { staticPrompts, dynamicPrompts } = await resolveSystemPromptSections(sections, context);
    // Agent prompt is always static (cacheable — it doesn't change per turn)
    const staticParts = [agentPrompt, ...staticPrompts];
    // S10: store in cache (key = sessionId:agentName)
    if (cacheKey) {
        _staticCache.set(cacheKey, { parts: staticParts, model: context.model });
    }
    return {
        staticParts,
        dynamicParts: [...dynamicPrompts, ...extraPrompts],
    };
}
export { clearCache as clearSystemPromptCache };
/** S10: clear cached static parts for a specific session. */
export function clearStaticCache(sessionId) {
    if (sessionId) {
        // Composite key: "sessionId:agentName" — delete all entries for this session
        const prefix = `${sessionId}:`;
        for (const key of _staticCache.keys()) {
            if (key.startsWith(prefix))
                _staticCache.delete(key);
        }
    }
    else {
        _staticCache.clear();
    }
}
//# sourceMappingURL=builder.js.map