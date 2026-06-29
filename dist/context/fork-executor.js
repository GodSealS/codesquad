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
import { ulid } from 'ulid';
// ── Fork Detection ──
/**
 * Check whether a skill should run in fork (isolated) context.
 */
export function isForkSkill(skill) {
    return skill.context === 'fork';
}
/**
 * Check whether a skill frontmatter indicates fork context.
 * Accepts either a SkillFrontmatter object or a raw context string.
 */
export function isForkContext(contextOrSkill) {
    if (!contextOrSkill)
        return false;
    if (typeof contextOrSkill === 'string')
        return contextOrSkill.trim() === 'fork';
    return contextOrSkill.context === 'fork';
}
// ── Ephemeral Session Factory ──
/**
 * Create a throwaway session for fork/subagent execution.
 * Not persisted to disk — discarded after the task completes.
 */
export function createEphemeralSession(name, modelConfig) {
    const now = new Date().toISOString();
    return {
        id: `fork-${ulid()}`,
        name,
        createdAt: now,
        updatedAt: now,
        agent: 'fork-executor',
        messages: [],
        context: { injectedFiles: [], injectedContent: '' },
        modelConfig: (modelConfig ?? {}),
        status: 'active',
        turnCount: 0,
        lastCompactTurn: 0,
        lastAssistantTimestamp: '',
    };
}
// ── Fork Markers on Session ──
const FORK_SKILL_KEY = '__pendingForkSkill';
/**
 * Set a pending fork skill marker on the session.
 * The marker is consumed by agent-runner before processing injectedContent.
 */
export function markForkSkill(session, pending) {
    session[FORK_SKILL_KEY] = pending;
}
/**
 * Read and CLEAR the pending fork skill marker.
 * Called by agent-runner at the start of the next turn.
 */
export function consumeForkSkill(session) {
    const pending = session[FORK_SKILL_KEY];
    if (pending) {
        delete session[FORK_SKILL_KEY];
    }
    return pending ?? null;
}
/**
 * Check if the session has a pending fork skill without consuming it.
 */
export function hasForkSkill(session) {
    return !!session[FORK_SKILL_KEY];
}
//# sourceMappingURL=fork-executor.js.map