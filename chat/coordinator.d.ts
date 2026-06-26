/**
 * Coordinator Mode — Multi-agent orchestration engine.
 *
 * Inspired by Claude Code's coordinatorMode.ts (18.93 KB).
 * A coordinator agent decomposes a user task into sub-tasks, dispatches them to
 * specialist sub-agents in parallel, and synthesizes results.
 *
 * Phase 5 — Chat Feature Gap Fill
 */
import type { Session } from './session.js';
export interface CoordinatorSubTask {
    id: string;
    agentId: string;
    description: string;
    status: 'pending' | 'running' | 'done' | 'error';
    output?: string;
    error?: string;
}
export interface CoordinatorContext {
    /** Scratchpad directory path for cross‑agent shared knowledge. */
    scratchpadDir: string;
    /** Active sub‑tasks in this orchestration round. */
    subTasks: Map<string, CoordinatorSubTask>;
    /** Results collected from completed sub‑agents. */
    collectedResults: string[];
}
export interface CoordinatorOptions {
    maxSubAgents: number;
    maxTurnsPerAgent: number;
    parallel: boolean;
}
export declare function createCoordinatorContext(session: Session, projectRoot: string): CoordinatorContext;
/**
 * Decompose a user task into sub‑tasks aligned with available specialist agents.
 *
 * The decomposition is heuristic (keyword‑based); a full implementation would
 * offload this to the LLM itself (coordinator LLM call). This provides a
 * fast default that avoids an extra model round trip.
 */
export declare function decomposeTask(task: string, coach: CoordinatorContext, options: CoordinatorOptions): CoordinatorSubTask[];
/**
 * Build a coordinator system prompt that describes available sub‑agents
 * and the scratchpad workflow.
 */
export declare function buildCoordinatorPrompt(subTasks: CoordinatorSubTask[], scratchpadDir: string): string;
/**
 * Write a sub‑agent's output to the scratchpad for the coordinator to read.
 */
export declare function writeScratchpadArtifact(coach: CoordinatorContext, agentId: string, content: string): string;
/**
 * Read all scratchpad artifacts for synthesis.
 */
export declare function readScratchpadArtifacts(coach: CoordinatorContext): string;
/**
 * Mark a sub‑task as complete and write its result.
 */
export declare function completeSubTask(coach: CoordinatorContext, agentId: string, output: string, isError?: boolean): void;
//# sourceMappingURL=coordinator.d.ts.map