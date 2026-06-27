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
// ── Instance ID Generator ──
let _instanceCounter = 0;
/** Generate a unique short ID like "ai-programmer-a1" */
function generateInstanceId(agentType) {
    _instanceCounter++;
    return `${agentType}-${_instanceCounter.toString(36)}`;
}
/** Sanitize user-provided instance name to a valid ID segment */
function sanitizeInstanceName(name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48).replace(/^-+/, '') || 'unnamed';
}
// ── Manager ──
export class AgentInstanceManager {
    instances = new Map();
    /**
     * Register a new agent instance.
     * @returns the instance ID for future lookup/cancel
     */
    register(params) {
        const id = generateInstanceId(params.agentType);
        const instanceName = params.instanceName
            ? sanitizeInstanceName(params.instanceName)
            : `${params.agentType}-${_instanceCounter}`;
        const instance = {
            id,
            instanceName,
            agentType: params.agentType,
            status: 'starting',
            task: params.task,
            startTime: Date.now(),
            abortController: new AbortController(),
        };
        this.instances.set(id, instance);
        return instance;
    }
    /** Mark an instance as running (transition from 'starting') */
    markRunning(id) {
        const inst = this.instances.get(id);
        if (!inst || inst.status !== 'starting')
            return false;
        inst.status = 'running';
        return true;
    }
    /** Mark an instance as completed */
    markDone(id, resultSummary, turns) {
        const inst = this.instances.get(id);
        if (!inst || inst.status === 'cancelled')
            return false;
        inst.status = 'done';
        inst.endTime = Date.now();
        inst.resultSummary = resultSummary;
        inst.turns = turns;
        return true;
    }
    /** Mark an instance as failed */
    markError(id, errorMessage) {
        const inst = this.instances.get(id);
        if (!inst || inst.status === 'cancelled')
            return false;
        inst.status = 'error';
        inst.endTime = Date.now();
        inst.errorMessage = errorMessage;
        return true;
    }
    /** Cancel a running instance by ID */
    cancel(id) {
        const inst = this.instances.get(id);
        if (!inst)
            return false;
        inst.abortController.abort();
        inst.status = 'cancelled';
        inst.endTime = Date.now();
        return true;
    }
    /** Cancel a running instance by name */
    cancelByName(instanceName) {
        for (const inst of this.instances.values()) {
            if (inst.instanceName === instanceName && inst.status === 'running') {
                return this.cancel(inst.id);
            }
        }
        return false;
    }
    /** Remove an instance from the registry */
    unregister(id) {
        return this.instances.delete(id);
    }
    /** Get an instance by ID */
    get(id) {
        return this.instances.get(id);
    }
    /** Find an instance by name */
    findByName(instanceName) {
        for (const inst of this.instances.values()) {
            if (inst.instanceName === instanceName)
                return inst;
        }
        return undefined;
    }
    /** List all instances (optionally filtered by status) */
    list(status) {
        const all = Array.from(this.instances.values());
        return status ? all.filter(i => i.status === status) : all;
    }
    /** Get count of active (non-terminal) instances */
    getActiveCount() {
        let count = 0;
        for (const inst of this.instances.values()) {
            if (inst.status === 'starting' || inst.status === 'running')
                count++;
        }
        return count;
    }
    /** Get status summary for display */
    getStatusSummary() {
        const summary = { total: 0, starting: 0, running: 0, done: 0, error: 0, cancelled: 0 };
        for (const inst of this.instances.values()) {
            summary.total++;
            switch (inst.status) {
                case 'starting':
                    summary.starting++;
                    break;
                case 'running':
                    summary.running++;
                    break;
                case 'done':
                    summary.done++;
                    break;
                case 'error':
                    summary.error++;
                    break;
                case 'cancelled':
                    summary.cancelled++;
                    break;
            }
        }
        return summary;
    }
    /** Clear all terminated (done/error/cancelled) instances from registry */
    cleanup() {
        let removed = 0;
        for (const [id, inst] of this.instances) {
            if (inst.status === 'done' || inst.status === 'error' || inst.status === 'cancelled') {
                this.instances.delete(id);
                removed++;
            }
        }
        return removed;
    }
}
// ── Singleton ──
let _instance = null;
export function initAgentInstanceManager() {
    _instance = new AgentInstanceManager();
    return _instance;
}
export function getAgentInstanceManager() {
    return _instance;
}
//# sourceMappingURL=instance-manager.js.map