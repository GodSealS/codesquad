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
import { buildTool } from './types.js';
import { findAgent } from '../agents/definition.js';
import { runAgent } from '../agents/runner.js';
import { getAgentLLMBridge } from '../agents/bridge.js';
import { getToolPool } from './registry.js';
import { AgentInputSchema, } from './AgentTool.js';
class AgentMapManager {
    map = new Map();
    static MAX_DEPTH = 3;
    /** Spawn or retrieve an agent. Returns existing entry if already running. */
    spawn(name, depth, spawnFn) {
        const existing = this.map.get(name);
        if (existing)
            return existing;
        if (depth > AgentMapManager.MAX_DEPTH) {
            // Package current context for escalation
            const parentDepth = AgentMapManager.MAX_DEPTH;
            const parentEntries = [...this.map.values()].filter(e => e.depth === parentDepth);
            const escalationCtx = parentEntries.map(e => `[${e.name}]: ${e.context.slice(0, 200)}`).join('\n');
            throw new AgentDepthError(`Depth limit (${AgentMapManager.MAX_DEPTH}) exceeded. Escalating to depth-${parentDepth} agent.\n${escalationCtx}`, escalationCtx);
        }
        const entry = {
            name,
            depth,
            promise: spawnFn(),
            context: '',
            createdAt: Date.now(),
        };
        // Chain: when the agent completes, store its context
        entry.promise = entry.promise.then(result => {
            entry.context = result.summary;
            return result;
        });
        this.map.set(name, entry);
        return entry;
    }
    /** Get accumulated context from all entries (for bidirectional passing). */
    getAllContext() {
        return [...this.map.values()]
            .map(e => `### ${e.name} (depth ${e.depth})\n${e.context}`)
            .join('\n\n');
    }
    /** Get context from a specific agent. */
    getContext(name) {
        return this.map.get(name)?.context ?? '';
    }
    /** Inject context into a specific agent (called by another agent to pass analysis). */
    injectContext(name, context) {
        const entry = this.map.get(name);
        if (entry) {
            entry.context = (entry.context ? entry.context + '\n\n' : '') + context;
        }
    }
    /** Count active entries. */
    get size() { return this.map.size; }
    /** Clear all entries (called on COMPLETED / CANCELLED). */
    clear() {
        this.map.clear();
    }
    /** Get all entries for persistence/restore on PARTIAL. */
    getEntries() {
        return this.map;
    }
    /** Get entry for a specific agent name. */
    get(name) {
        return this.map.get(name);
    }
}
/** Error thrown when agent nesting depth is exceeded. */
export class AgentDepthError extends Error {
    escalationContext;
    constructor(message, escalationContext) {
        super(message);
        this.name = 'AgentDepthError';
        this.escalationContext = escalationContext;
    }
}
// ── Shared AgentMap instance ──
let currentAgentMap = null;
export function getAgentMap() {
    if (!currentAgentMap) {
        currentAgentMap = new AgentMapManager();
    }
    return currentAgentMap;
}
export function clearAgentMap() {
    currentAgentMap = null;
}
export function newAgentMapSession() {
    currentAgentMap = new AgentMapManager();
    return currentAgentMap;
}
// ── Agent Resolution (no subagent check) ──
function resolveAnyAgent(subagentType) {
    return findAgent(subagentType);
}
// ── Tool ──
export const AgentToolSuper = buildTool({
    name: 'AgentSuper',
    description: 'Delegate a task to a specialized subagent. Use for expert consultation during workflows like grill-me.',
    searchHint: 'delegate agent spawn task subagent super',
    inputSchema: AgentInputSchema,
    maxResultSizeChars: 20_000,
    isReadOnly() {
        return false;
    },
    isConcurrencySafe() {
        return true;
    },
    isDestructive() {
        return false;
    },
    prompt() {
        return [
            '## Agent Tool (Super) — Expert Consultation',
            '',
            'Spawn a specialized agent for domain-specific analysis. The agent runs',
            'with its own context and returns a summary.',
            '',
            '### Available agents (any .codesquad agent can be spawned)',
            'Use the agent name directly (e.g., "technical-director", "creative-director").',
            '',
            '### Parameters',
            '- `subagent_type` (required): Which agent to spawn',
            '- `description` (required): Brief task description',
            '- `prompt` (required): Detailed task instructions with context',
            '- `run_in_background` (optional): Set to true for fire-and-forget',
            '',
            '### Nesting depth limit',
            'Maximum 3 levels deep. If exceeded, results are escalated to the depth-2 agent.',
        ].join('\n');
    },
    descriptionFor(input) {
        return `Consult ${input.subagent_type}: ${input.description}`;
    },
    validateInput(input, _context) {
        // No subagent:true check — can spawn any .codesquad agent
        const agent = resolveAnyAgent(input.subagent_type);
        if (!agent) {
            return {
                valid: false,
                message: `Unknown agent: "${input.subagent_type}". Available agents include creative-director, technical-director, producer, systems-designer, etc.`,
            };
        }
        return { valid: true };
    },
    checkPermissions(_input, _context) {
        return { behavior: 'allow' };
    },
    async call(input, context) {
        const { subagent_type, description, prompt, run_in_background } = input;
        // Resolve agent (no subagent restriction)
        const baseAgent = resolveAnyAgent(subagent_type);
        if (!baseAgent) {
            return {
                toolCallId: '',
                output: { summary: '' },
                content: `[Error] Unknown agent: "${subagent_type}"`,
                isError: true,
            };
        }
        // Grill-me safety: all spawned agents are read-only analysts.
        // Override tools to remove destructive tools, keeping only Read/Glob/Grep/WebSearch.
        const READONLY_TOOLS = new Set(['Read', 'Glob', 'Grep', 'WebSearch']);
        const agent = {
            ...baseAgent,
            tools: baseAgent.tools
                ? baseAgent.tools.filter((t) => READONLY_TOOLS.has(t))
                : [],
            disallowedTools: [
                ...(baseAgent.disallowedTools || []),
                'Write', 'Edit', 'Bash', 'Agent', 'TodoWrite',
            ],
        };
        // Get LLM bridge
        const bridge = getAgentLLMBridge();
        if (!bridge) {
            return {
                toolCallId: '',
                output: { summary: '' },
                content: '[Error] Agent LLM bridge not configured.',
                isError: true,
            };
        }
        // Determine depth from AgentMap context
        const agentMap = getAgentMap();
        const callingDepth = context.__agentDepth ?? 0;
        const newDepth = callingDepth + 1;
        // Dedup via AgentMap
        try {
            const entry = agentMap.spawn(subagent_type, newDepth, async () => {
                try {
                    // Build model config
                    const effectiveModelConfig = {
                        ...context.session.modelConfig,
                    };
                    const result = await runAgent({
                        definition: agent,
                        task: prompt,
                        parentSession: context.session,
                        modelConfig: effectiveModelConfig,
                        availableTools: getToolPool(),
                        parentPermissionMode: context.permissionMode,
                        projectRoot: context.projectRoot,
                        systemPromptSections: [],
                        callLLM: bridge.callLLM,
                        runtimeConfig: bridge.runtimeConfig,
                        abortSignal: context.abortSignal,
                    });
                    return {
                        summary: result.summary || result.messages.map(m => m.content).join('\n'),
                        turns: result.turns,
                    };
                }
                catch (err) {
                    throw err;
                }
            });
            // Set depth marker for child agent context
            context.__agentDepth = newDepth;
            if (run_in_background || agent.background) {
                // Fire-and-forget
                return {
                    toolCallId: '',
                    output: { summary: `[Background] ${subagent_type} spawned` },
                    content: `✅ Agent "${subagent_type}" spawned in background: ${description}`,
                };
            }
            // Synchronous: await the promise
            const result = await entry.promise;
            // Inject result into agent map context
            agentMap.injectContext(subagent_type, result.summary);
            return {
                toolCallId: '',
                output: { summary: result.summary },
                content: result.summary,
            };
        }
        catch (err) {
            if (err instanceof AgentDepthError) {
                return {
                    toolCallId: '',
                    output: { summary: '' },
                    content: `[Depth Limit] ${err.message}`,
                };
            }
            return {
                toolCallId: '',
                output: { summary: '' },
                content: `[Error] Agent ${subagent_type} failed: ${err.message}`,
                isError: true,
            };
        }
    },
});
//# sourceMappingURL=AgentToolSuper.js.map