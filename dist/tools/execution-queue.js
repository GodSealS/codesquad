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
import { findTool, runToolUse } from './registry.js';
import { touchTool } from './dynamic-registry.js';
// ── Tick yield helper ──
/** Yield control back to the event loop (simulates a frame boundary). */
function yieldTick() {
    return new Promise((r) => setImmediate(r));
}
// ── Queue State ──
let _progressListeners = new Set();
let _currentProgress = {
    total: 0,
    completed: 0,
    currentTool: null,
    phase: 'idle',
};
function emitProgress(partial) {
    _currentProgress = { ..._currentProgress, ...partial };
    for (const cb of _progressListeners) {
        try {
            cb(_currentProgress);
        }
        catch {
            // Listener errors must not break the queue
        }
    }
}
// ── Public API ──
/**
 * Subscribe to tool execution progress events.
 * Returns an unsubscribe function.
 */
export function onToolProgress(cb) {
    _progressListeners.add(cb);
    return () => _progressListeners.delete(cb);
}
/**
 * Get the current queue progress snapshot.
 */
export function getToolProgress() {
    return { ..._currentProgress };
}
/**
 * Reset queue state (call at start of each agent turn).
 */
export function resetToolQueue() {
    _currentProgress = { total: 0, completed: 0, currentTool: null, phase: 'idle' };
}
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
export async function executeToolBatch(toolCalls, context) {
    if (toolCalls.length === 0)
        return [];
    // ── Dedup: skip identical calls within the same batch ──
    // LLM sometimes emits duplicate tool calls (e.g., 3× mkdir). 
    // Key = name + sorted JSON input; first occurrence executes, duplicates copy result.
    const dedupKey = (tc) => `${tc.name}:${JSON.stringify(tc.input, Object.keys(tc.input).sort())}`;
    const seen = new Map(); // key → first index
    const deduped = [];
    const dupMap = new Map(); // dupIndex → firstIndex
    for (let i = 0; i < toolCalls.length; i++) {
        const tc = toolCalls[i];
        const key = dedupKey(tc);
        const firstIdx = seen.get(key);
        if (firstIdx !== undefined) {
            dupMap.set(i, firstIdx);
            console.log(`[exec-queue] Dedup: skip ${tc.name} #${i + 1} (same as #${firstIdx + 1})`);
        }
        else {
            seen.set(key, i);
            deduped.push({ index: i, tc });
        }
    }
    // ── Classify by read-only status (using deduped list) ──
    const readOnly = [];
    const write = [];
    for (const { index, tc } of deduped) {
        const tool = findTool(tc.name);
        const isReadOnly = tool?.isReadOnly() ?? false;
        if (isReadOnly) {
            readOnly.push({ index, tc });
        }
        else {
            write.push({ index, tc });
        }
    }
    const total = toolCalls.length;
    // Result array maintains original ordering
    const results = new Array(total);
    let completed = 0;
    // ── Phase 1: Parallel read-only ──
    if (readOnly.length > 0) {
        emitProgress({
            total,
            completed: 0,
            currentTool: readOnly.length === 1
                ? readOnly[0].tc.name
                : `${readOnly.length} read-only tools`,
            phase: 'parallel_read',
        });
        const parallelResults = await Promise.all(readOnly.map(async ({ index, tc }) => {
            emitProgress({
                currentTool: tc.name,
            });
            const result = await runToolUse({
                toolName: tc.name,
                rawInput: tc.input,
                context,
            });
            touchTool(tc.name);
            return { index, name: tc.name, input: tc.input, result };
        }));
        for (const pr of parallelResults) {
            results[pr.index] = { name: pr.name, input: pr.input, result: pr.result };
            completed++;
        }
        emitProgress({ completed, currentTool: null });
    }
    // ── Phase 2: Sequential writes with tick yield ──
    if (write.length > 0) {
        emitProgress({
            total,
            completed,
            phase: 'sequential_write',
            currentTool: write[0].tc.name,
        });
        for (const { index, tc } of write) {
            emitProgress({ currentTool: tc.name });
            const result = await runToolUse({
                toolName: tc.name,
                rawInput: tc.input,
                context,
            });
            touchTool(tc.name);
            results[index] = { name: tc.name, input: tc.input, result };
            completed++;
            emitProgress({ completed, currentTool: null });
            // Yield to event loop after each write (tick boundary)
            if (completed < total) {
                await yieldTick();
            }
        }
    }
    // ── Copy results for duplicate calls ──
    for (const [dupIdx, firstIdx] of dupMap) {
        const src = results[firstIdx];
        if (src) {
            results[dupIdx] = { ...src };
        }
    }
    // ── Done ──
    emitProgress({ phase: 'done', currentTool: null, completed: total });
    return results;
}
//# sourceMappingURL=execution-queue.js.map