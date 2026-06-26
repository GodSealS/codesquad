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
import type { SystemPromptSection, PromptSectionContext } from './sections.js';
import { clearSystemPromptSections as clearCache } from './sections.js';
export interface SystemPromptOptions {
    /** Full replacement prompt — used by --system-prompt CLI arg. */
    overrideSystemPrompt?: string | string[];
    /** Agent-specific system prompt (from AICore/agents/*.md). */
    agentSystemPrompt?: string;
    /** Custom system prompt from user config. */
    customSystemPrompt?: string;
    /** Always-appended prompt (project guidance, CLAUDE.md, etc.). */
    appendSystemPrompt?: string[];
    /** Section context for compute functions. */
    context: PromptSectionContext;
    /** Additional sections to include beyond defaults. */
    extraSections?: SystemPromptSection[];
}
/**
 * Build the effective system prompt.
 * Returns an array of prompt strings (will be joined with double-newline for API).
 */
export declare function buildEffectiveSystemPrompt(options: SystemPromptOptions): Promise<string[]>;
/**
 * Build system prompt specifically for agent conversation.
 * Includes: project guidance + agent prompt + mode prompt + skill guidance + tool guidance.
 *
 * Feature 4 (P4 Prompt Caching): Returns separated static/dynamic parts for cache_control.
 * Static parts can be cached by Anthropic API; dynamic parts are recomputed each turn.
 */
export declare function buildAgentSystemPrompt(agentPrompt: string, context: PromptSectionContext, extraPrompts?: string[]): Promise<string[]>;
/**
 * Build system prompt with separation of cacheable static vs. uncached dynamic parts.
 * Feature 4 (P4): Enables Anthropic prompt caching for static sections.
 */
export declare function buildAgentSystemPromptSeparated(agentPrompt: string, context: PromptSectionContext, extraPrompts?: string[]): Promise<{
    staticParts: string[];
    dynamicParts: string[];
}>;
export { clearCache as clearSystemPromptCache };
//# sourceMappingURL=builder.d.ts.map