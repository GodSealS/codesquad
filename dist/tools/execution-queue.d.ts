/**
 * Tool Execution Queue — Command Queue + Tick + Parallel Read-Only Batching.
 *
 * Replaces the simple for...of loop in agent-runner.ts with:
 *   - Phase 1 (parallel): all read-only tools execute via Promise.all
 *   - Phase 2 (sequential): write tools execute one at a time with tick yield
 *   - Progress events for Web UI SSE streaming
 *
 * Architecture:
 *   LLM response → enqueue(toolCalls) → processAll() →
 *     tick() → tick() → ... → done → next API call
 *
 * References:
 *   Claude Code src/tools/toolExecution.ts — sequential for...of loop
 *   This module extends that model with parallel-safe read-only batching.
 */
import type { ToolUseContext, ToolResult } from './types.js';
export type QueuePhase = 'idle' | 'parallel_read' | 'sequential_write' | 'done';
export interface QueueProgress {
    /** Total tool calls in this batch. */
    total: number;
    /** Completed so far. */
    completed: number;
    /** Current tool being executed (null if idle). */
    currentTool: string | null;
    /** Current execution phase. */
    phase: QueuePhase;
}
export type ProgressCallback = (progress: QueueProgress) => void;
export interface EnqueuedTool {
    name: string;
    input: Record<string, unknown>;
}
/**
 * Subscribe to tool execution progress events.
 * Returns an unsubscribe function.
 */
export declare function onToolProgress(cb: ProgressCallback): () => void;
/**
 * Get the current queue progress snapshot.
 */
export declare function getToolProgress(): Readonly<QueueProgress>;
/**
 * Reset queue state (call at start of each agent turn).
 */
export declare function resetToolQueue(): void;
/**
 * Execute a batch of tool calls from a single LLM response.
 *
 * Phase 1 (parallel): All read-only tools run concurrently via Promise.all.
 *   Read/Grep/Glob/LSP/WebSearch/WebFetch/ToolSearch/TaskGet/TaskList/Skill
 *   are all safe to run in parallel because they don't mutate state.
 *
 * Phase 2 (sequential): Each write tool runs one at a time with a tick yield
 *   between each to release the event loop. This ensures tool result ordering
 *   matches the LLM's intended sequence (important when LLM orders writes
 *   deliberately, e.g. "create file A, then reference it from file B").
 *
 * @returns Array of execution results in the SAME order as the input toolCalls,
 *          so the agent-runner can append tool_result messages in the correct sequence.
 */
export declare function executeToolBatch(toolCalls: EnqueuedTool[], context: ToolUseContext): Promise<Array<{
    name: string;
    input: Record<string, unknown>;
    result: ToolResult;
}>>;
//# sourceMappingURL=execution-queue.d.ts.map