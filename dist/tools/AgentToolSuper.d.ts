/**
 * AgentToolSuper — extends AgentTool with unrestricted agent spawning + AgentMap dedup.
 *
 * Differences from AgentTool:
 *   1. No subagent:true validation — can spawn ANY .codesquad agent.
 *   2. AgentMap dedup: each agent name spawns at most once per session.
 *   3. Nesting depth tracking: max depth 3, beyond which delegates back to depth-2 agent.
 *   4. Bidirectional context support: calling agent passes partial analysis,
 *      receiving agent injects its output back into the caller's context.
 *   5. Map lifecycle: cleared on COMPLETED/CANCELLED, preserved on PARTIAL.
 *
 * Used by grill-me and other agent-agnostic workflows.
 */
import { z } from 'zod';
import { type Tool } from './types.js';
import { AgentInputSchema } from './AgentTool.js';
export type AgentInput = z.infer<typeof AgentInputSchema>;
interface AgentMapEntry {
    /** Agent definition resolved name. */
    name: string;
    /** Current nesting depth (1-indexed from the parent workflow). */
    depth: number;
    /** Promise for the running/spawned agent. */
    promise: Promise<AgentRunResult>;
    /** Context accumulated during execution (partial analysis). */
    context: string;
    /** Timestamp of creation. */
    createdAt: number;
}
interface AgentRunResult {
    summary: string;
    turns: number;
}
declare class AgentMapManager {
    private map;
    private static MAX_DEPTH;
    /** Spawn or retrieve an agent. Returns existing entry if already running. */
    spawn(name: string, depth: number, spawnFn: () => Promise<AgentRunResult>): AgentMapEntry;
    /** Get accumulated context from all entries (for bidirectional passing). */
    getAllContext(): string;
    /** Get context from a specific agent. */
    getContext(name: string): string;
    /** Inject context into a specific agent (called by another agent to pass analysis). */
    injectContext(name: string, context: string): void;
    /** Count active entries. */
    get size(): number;
    /** Clear all entries (called on COMPLETED / CANCELLED). */
    clear(): void;
    /** Get all entries for persistence/restore on PARTIAL. */
    getEntries(): ReadonlyMap<string, AgentMapEntry>;
    /** Get entry for a specific agent name. */
    get(name: string): AgentMapEntry | undefined;
}
/** Error thrown when agent nesting depth is exceeded. */
export declare class AgentDepthError extends Error {
    readonly escalationContext: string;
    constructor(message: string, escalationContext: string);
}
export declare function getAgentMap(): AgentMapManager;
export declare function clearAgentMap(): void;
export declare function newAgentMapSession(): AgentMapManager;
export declare const AgentToolSuper: Tool<AgentInput, {
    summary: string;
}>;
export {};
//# sourceMappingURL=AgentToolSuper.d.ts.map