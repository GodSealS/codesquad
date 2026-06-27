/**
 * Agent Instance Manager — tracks all active agent instances for lifecycle control.
 *
 * ## Purpose
 * - Register/unregister agent instances with unique names
 * - Track status (running/done/error/cancelled)
 * - Support future complex scheduling (dependencies, parallelism control)
 * - Provide cancel-by-name capability
 *
 * ## Anchors for Future Scheduling
 * Each instance gets a unique `instanceName` that can be referenced by:
 * - Other agents: "wait for enemy-patrol-ai before spawning combat-ai"
 * - Coordinator: "agent terrain-generator failed, retry with different model"
 * - User CLI: "/agent cancel terrain-generator-2"
 */
export type AgentInstanceStatus = 'starting' | 'running' | 'done' | 'error' | 'cancelled';
export interface AgentInstance {
    /** Unique instance ID (ULID-style, e.g. "ai-programmer-3a7f") */
    id: string;
    /** Human-readable instance name, auto-generated or user-provided */
    instanceName: string;
    /** Agent type (definition name, e.g. "ai-programmer") */
    agentType: string;
    /** Current status */
    status: AgentInstanceStatus;
    /** Task description */
    task: string;
    /** Start timestamp */
    startTime: number;
    /** End timestamp (set on done/error/cancelled) */
    endTime?: number;
    /** Result summary (populated on done) */
    resultSummary?: string;
    /** Error message (populated on error) */
    errorMessage?: string;
    /** Number of LLM turns executed */
    turns?: number;
    /** Abort controller for cancellation */
    abortController: AbortController;
}
export declare class AgentInstanceManager {
    private instances;
    /**
     * Register a new agent instance.
     * @returns the instance ID for future lookup/cancel
     */
    register(params: {
        agentType: string;
        task: string;
        instanceName?: string;
    }): AgentInstance;
    /** Mark an instance as running (transition from 'starting') */
    markRunning(id: string): boolean;
    /** Mark an instance as completed */
    markDone(id: string, resultSummary: string, turns: number): boolean;
    /** Mark an instance as failed */
    markError(id: string, errorMessage: string): boolean;
    /** Cancel a running instance by ID */
    cancel(id: string): boolean;
    /** Cancel a running instance by name */
    cancelByName(instanceName: string): boolean;
    /** Remove an instance from the registry */
    unregister(id: string): boolean;
    /** Get an instance by ID */
    get(id: string): AgentInstance | undefined;
    /** Find an instance by name */
    findByName(instanceName: string): AgentInstance | undefined;
    /** List all instances (optionally filtered by status) */
    list(status?: AgentInstanceStatus): AgentInstance[];
    /** Get count of active (non-terminal) instances */
    getActiveCount(): number;
    /** Get status summary for display */
    getStatusSummary(): {
        total: number;
        starting: number;
        running: number;
        done: number;
        error: number;
        cancelled: number;
    };
    /** Clear all terminated (done/error/cancelled) instances from registry */
    cleanup(): number;
}
export declare function initAgentInstanceManager(): AgentInstanceManager;
export declare function getAgentInstanceManager(): AgentInstanceManager | null;
//# sourceMappingURL=instance-manager.d.ts.map