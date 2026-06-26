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
 *   5. appendSystemPrompt      — always appended (AICore/CODESSQUAD.md, etc.)
 *
 * Phase 3.2
 */
import { resolveSystemPromptSections, clearSystemPromptSections as clearCache } from './sections.js';
import { getDefaultSections } from './builtin-sections.js';
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
    const sections = [
        ...getDefaultSections(),
    ];
    const { staticPrompts, dynamicPrompts } = await resolveSystemPromptSections(sections, context);
    // Agent prompt is always static (cacheable — it doesn't change per turn)
    return {
        staticParts: [agentPrompt, ...staticPrompts],
        dynamicParts: [...dynamicPrompts, ...extraPrompts],
    };
}
export { clearCache as clearSystemPromptCache };
//# sourceMappingURL=builder.js.map