/**
 * Built-in system prompt sections — each maps to a named section.
 *
 * References:
 *   Claude Code src/constants/prompts.ts — getSimpleIntroSection, etc.
 *
 * Phase 3.1
 */
import { type SystemPromptSection } from './sections.js';
export declare function invalidateProjectGuidance(): void;
/**
 * Simple introduction — agent identity + safety rules.
 */
export declare function getSimpleIntroSection(): SystemPromptSection;
/**
 * System behavior rules — collaboration protocol.
 */
export declare function getSystemBehaviorSection(): SystemPromptSection;
/**
 * Doing tasks — coding standards.
 */
export declare function getDoingTasksSection(): SystemPromptSection;
/**
 * Tone and style.
 * Now cached (P2 fix): ctx.lang is session-level and doesn't change per turn.
 */
export declare function getToneAndStyleSection(): SystemPromptSection;
/**
 * Environment information — OS, shell, date, cwd, git.
 */
export declare function getEnvInfoSection(): SystemPromptSection;
/**
 * Language preference.
 * Now cached (P2 fix): ctx.lang is session-level and doesn't change per turn.
 */
export declare function getLanguageSection(): SystemPromptSection;
/**
 * Project guidance — CODESQUAD.md + CODEBUDDY.md.
 */
export declare function getProjectGuidanceSection(): SystemPromptSection;
export declare function setGlobalGuidanceFlags(extraDirs?: string[], bare?: boolean): void;
/**
 * Cross-chat memory — summaries from recent sessions.
 * Yields to current-session context when the conversation is already deep (>20 messages).
 */
export declare function getCrossChatMemorySection(): SystemPromptSection;
/**
 * Available tools guidance.
 */
export declare function getToolsSection(): SystemPromptSection;
/**
 * Tool-use format instructions.
 */
export declare function getToolUseFormatSection(): SystemPromptSection;
/**
 * Available subagents listing.
 */
export declare function getAvailableAgentsSection(): SystemPromptSection;
/**
 * Conditional rules — inject rules that match the current session context.
 * Uses path-based matching when files are being edited (via FileWrite/Edit contexts).
 * Now cached per session (P2 fix): rules rarely change mid-session.
 * Users should /clear or /compact to pick up rule changes.
 */
export declare function getConditionalRulesSection(): SystemPromptSection;
/**
 * Active task status (Feature 2, P4).
 * Injects current task list into system prompt so agent knows about pending/active tasks.
 * Uncached because tasks change per turn.
 */
export declare function getTaskStatusSection(): SystemPromptSection;
/**
 * Cached file summaries from DiskCache.
 * Injects a compact overview of files cached in the current project.
 * Cached (computed once per session) because file cache is stable.
 */
export declare function getCachedFileSummariesSection(): SystemPromptSection;
/**
 * Memory guidance — type taxonomy + save/access rules. (M2)
 */
export declare function getMemoryGuidanceSection(): SystemPromptSection;
/**
 * Get all built-in sections in priority order.
 */
export declare function getDefaultSections(): SystemPromptSection[];
//# sourceMappingURL=builtin-sections.d.ts.map