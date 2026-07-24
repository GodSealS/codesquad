/**
 * Fork context executor — shared logic for running skills/agents in isolated sessions.
 *
 * When a skill has `context: fork` in its frontmatter, or a subagent is spawned,
 * the execution should happen in an ephemeral session that is discarded after
 * completion. Only the summary is returned to the parent context.
 *
 * This prevents multi-phase skill/agent execution from polluting the parent
 * conversation with intermediate tool calls and reasoning steps.
 */
import type { Session, ModelConfig } from '../chat/session.js';
import type { SkillFrontmatter } from '../repl/skill-frontmatter.js';
/** Pending fork skill marker stored on the session. */
export interface PendingForkSkill {
    /** Skill name (e.g. "asset-spec"). */
    skillName: string;
    /** Full assembled skill body (SKILL.md content with matched sub-files). */
    content: string;
    /** Optional arguments passed to the skill. */
    args?: string;
    /** The skill's declared model override (from frontmatter). */
    model?: string;
    /** Allowed tools for the fork skill (from frontmatter). */
    allowedTools?: string[];
}
/** Fork execution result — summary to inject into parent context. */
export interface ForkExecutionResult {
    /** Markdown summary suitable for injection into parent session. */
    summary: string;
    /** Whether the execution was truncated (hit max turns). */
    truncated: boolean;
    /** Number of turns taken. */
    turns: number;
    /** Token usage stats (if available). */
    usage?: {
        promptTokens: number;
        completionTokens: number;
    };
}
/**
 * Check whether a skill should run in fork (isolated) context.
 */
export declare function isForkSkill(skill: SkillFrontmatter): boolean;
/**
 * Check whether a skill frontmatter indicates fork context.
 * Accepts either a SkillFrontmatter object or a raw context string.
 */
export declare function isForkContext(contextOrSkill: string | SkillFrontmatter | undefined): boolean;
/**
 * Create a throwaway session for fork/subagent execution.
 * Not persisted to disk — discarded after the task completes.
 */
export declare function createEphemeralSession(name: string, modelConfig?: Partial<ModelConfig>): Session;
/**
 * Set a pending fork skill marker on the session.
 * The marker is consumed by agent-runner before processing injectedContent.
 */
export declare function markForkSkill(session: Session, pending: PendingForkSkill): void;
/**
 * Read and CLEAR the pending fork skill marker.
 * Called by agent-runner at the start of the next turn.
 */
export declare function consumeForkSkill(session: Session): PendingForkSkill | null;
/**
 * Check if the session has a pending fork skill without consuming it.
 */
export declare function hasForkSkill(session: Session): boolean;
//# sourceMappingURL=fork-executor.d.ts.map