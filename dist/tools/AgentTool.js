/**
 * AgentTool — spawn a subagent for delegated tasks.
 *
 * References:
 *   Claude Code src/tools/AgentTool/AgentTool.ts (229KB)
 *
 * Phase 6.2 / 6.5
 */
import { z } from 'zod';
import { buildTool } from './types.js';
import { findAgent, listAgents } from '../agents/definition.js';
import { runAgent } from '../agents/runner.js';
import { getAgentLLMBridge } from '../agents/bridge.js';
import { getToolPool } from './registry.js';
import { getAgentInstanceManager } from '../agents/instance-manager.js';
import { exploreAgent } from '../agents/builtin/explore.js';
import { generalPurposeAgent } from '../agents/builtin/general-purpose.js';
import { sanityCheckAgent } from '../agents/builtin/sanity-check.js';
import { fixAgent } from '../agents/builtin/fix.js';
import { refactorAgent } from '../agents/builtin/refactor.js';
import { testAgent } from '../agents/builtin/test.js';
// Coordinator mode — multi-agent orchestration (Phase P1 fix)
import { createCoordinatorContext, decomposeTask, writeScratchpadArtifact, readScratchpadArtifacts, } from '../chat/coordinator.js';
// ── Schema ──
export const AgentInputSchema = z.object({
    subagent_type: z.string().min(1).describe('Type of subagent to spawn: explore, sanity-check, fix, refactor, test, general-purpose, or any .codesquad agent name'),
    description: z.string().max(500).describe('Brief description of the task'),
    prompt: z.string().min(1).max(50000).describe('Task instructions for the subagent'),
    run_in_background: z.boolean().optional().default(false).describe('Run asynchronously (fire-and-forget)'),
    coordinator: z.boolean().optional().default(false).describe('Enable multi-agent coordinator mode — decompose task across specialists'),
    instance_name: z.string().max(48).optional().describe('Unique name for this instance (auto-generated if omitted). Used for future scheduling: "wait for enemy-patrol-ai"'),
});
// ── Subagent type descriptions (centralized) ──
const BUILTIN_SUBAGENTS = {
    'explore': { whenToUse: 'Read-only code exploration — search files, understand structure.' },
    'sanity-check': { whenToUse: 'Quick read-only bug/anti-pattern/style check. Do NOT use for /code-review.' },
    'fix': { whenToUse: 'Fix a specific bug in a single file. Minimal change, no refactoring.' },
    'refactor': { whenToUse: 'Restructure code without changing behavior (extract, rename, simplify).' },
    'test': { whenToUse: 'Write or fix unit tests for existing code. Do NOT use for /tdd workflow.' },
    'general-purpose': { whenToUse: 'Full-capability agent — read, write, edit, run commands.' },
};
// ── Model routing (cheaper models for lightweight subagents) ──
// NOTE: These model names must exist in the user's models.config.yaml.
// If a model is unavailable, the runtime will error — adjust names to match your setup.
const SUBAGENT_MODEL_OVERRIDE = {
    'explore': 'deepseek-v4-flash',
    'sanity-check': 'deepseek-v4-flash',
    'fix': 'deepseek-v4-flash',
    // refactor / test / general-purpose use parent model or agent's own model
};
// ── Tool ──
export const AgentTool = buildTool({
    name: 'Agent',
    description: 'Delegate a task to a specialized subagent. Use for exploration, code review, or parallel work.',
    searchHint: 'delegate agent spawn task subagent',
    inputSchema: AgentInputSchema,
    maxResultSizeChars: 20_000,
    isReadOnly() {
        return false; // Subagent may perform writes
    },
    isConcurrencySafe() {
        return true;
    },
    isDestructive() {
        return false;
    },
    prompt() {
        // Build available subagent list dynamically
        const agentList = Object.entries(BUILTIN_SUBAGENTS)
            .map(([type, info]) => `  - "${type}": ${info.whenToUse}`)
            .join('\n');
        // Include .codesquad agents marked as subagents
        const aicoreSubagents = listAgents().filter((a) => a.subagent);
        let aicoreSection = '';
        if (aicoreSubagents.length > 0) {
            aicoreSection = '\n### .codesquad specialist subagents (domain-specific)\n' +
                aicoreSubagents.map((a) => `  - "${a.agentType}": ${a.whenToUse}`).join('\n');
        }
        return [
            '## Agent Tool — Internal Task Delegation',
            '',
            'Spawn a specialized subagent to handle a subtask. The subagent runs',
            'with its own context and returns a summary when done.',
            '',
            '### CRITICAL: Subagents vs Skills',
            '- Subagents are YOUR internal helpers — do NOT mention them to the user',
            '- If the user asked to run a skill (e.g., /code-review, /tdd, /tech-debt),',
            '  do NOT use Agent tool as a substitute — invoke the skill workflow instead',
            '- Subagents are for: quick validation, second-opinion checks, parallel subtasks',
            '- Skills are for: user-requested multi-phase workflows',
            '',
            '### Built-in subagent types',
            agentList + aicoreSection,
            '',
            '### Parameters',
            '- `subagent_type` (required): Which agent to spawn',
            '- `description` (required): Brief task description',
            '- `prompt` (required): Detailed task instructions',
            '- `run_in_background` (optional): Set to true for fire-and-forget async execution',
            '',
            '### Choosing the right subagent',
            '- "explore" for codebase exploration and search',
            '- "sanity-check" for quick file-level bug/quality check (not /code-review)',
            '- "fix" for single-file targeted bug fixes',
            '- "refactor" for small-scope restructuring',
            '- "test" for generating/fixing unit tests (not /tdd)',
            '- "general-purpose" when you need full read/write/execute capability',
            '- .codesquad agents (lead-programmer, gameplay-programmer, etc.) for domain-specific tasks',
        ].join('\n');
    },
    descriptionFor(input) {
        const bg = input.run_in_background ? ' [background]' : '';
        return `Spawn ${input.subagent_type}${bg}: ${input.description}`;
    },
    validateInput(input, _context) {
        // Built-ins always valid
        if (Object.keys(BUILTIN_SUBAGENTS).includes(input.subagent_type)) {
            return { valid: true };
        }
        // Try .codesquad agent lookup — must be loaded AND marked as subagent
        const aicoreAgent = findAgent(input.subagent_type);
        if (aicoreAgent) {
            return aicoreAgent.subagent
                ? { valid: true }
                : { valid: false, message: `"${input.subagent_type}" is not available as a subagent. Use agents marked with subagent: true in their frontmatter.` };
        }
        // Agents not loaded yet — allow with warning (will error at call time if still missing)
        if (!_agentsLoaded()) {
            return { valid: true };
        }
        return {
            valid: false,
            message: `Unknown subagent type: "${input.subagent_type}". Available built-ins: ${Object.keys(BUILTIN_SUBAGENTS).join(', ')}`,
        };
    },
    checkPermissions(_input, _context) {
        return { behavior: 'allow' };
    },
    async call(input, context) {
        const { subagent_type, description, prompt, run_in_background } = input;
        // S04: Per-session agent spawn limit — prevents infinite nesting and "ball-kicking"
        // where the main agent delegates to sub-agents in a loop across turns.
        const MAX_AGENT_SPAWNS = 5;
        if (context.session.agentSpawnCount >= MAX_AGENT_SPAWNS) {
            return {
                toolCallId: '',
                output: { summary: '' },
                content: `[Error] Agent spawn limit reached (${MAX_AGENT_SPAWNS}). This session has already spawned ${context.session.agentSpawnCount} sub-agents. To prevent infinite nesting loops, no more agents can be spawned. Start a new conversation if you need more sub-agents.`,
                isError: true,
            };
        }
        // Register with instance manager (anchor for future scheduling)
        const mgr = getAgentInstanceManager();
        let instance = null;
        if (mgr) {
            instance = mgr.register({
                agentType: subagent_type,
                task: description,
                instanceName: input.instance_name,
            });
        }
        // Find agent definition (check built-ins first, then .codesquad)
        let agent = resolveToAgent(subagent_type);
        if (!agent) {
            if (instance && mgr)
                mgr.markError(instance.id, `Unknown subagent type: "${subagent_type}"`);
            return {
                toolCallId: '',
                output: { summary: '' },
                content: `[Error] Unknown subagent type: "${subagent_type}". Available: ${Object.keys(BUILTIN_SUBAGENTS).join(', ')}`,
                isError: true,
            };
        }
        // Apply model override (cheaper model for lightweight subagents).
        // P0 fix: override always wins for designated agents, applied via modelConfig
        // so runner picks it up with priority `modelConfig.model || definition.model`.
        const effectiveModelConfig = {
            ...context.session.modelConfig,
            ...(SUBAGENT_MODEL_OVERRIDE[subagent_type] ? { model: SUBAGENT_MODEL_OVERRIDE[subagent_type] } : {}),
        };
        // Get LLM bridge
        const bridge = getAgentLLMBridge();
        if (!bridge) {
            if (instance && mgr)
                mgr.markError(instance.id, 'Agent LLM bridge not configured');
            return {
                toolCallId: '',
                output: { summary: '' },
                content: '[Error] Agent LLM bridge not configured. Cannot spawn subagent.',
                isError: true,
            };
        }
        // Mark instance as running
        if (instance && mgr)
            mgr.markRunning(instance.id);
        // ── Coordinator mode (multi-agent orchestration) ──
        if (input.coordinator) {
            const coordOptions = { maxSubAgents: 3, maxTurnsPerAgent: 15, parallel: false };
            const coach = createCoordinatorContext(context.session, context.projectRoot);
            const subTasks = decomposeTask(input.prompt || input.description, coach, coordOptions);
            if (subTasks.length === 0) {
                // No sub-tasks decomposed — fall through to normal synchronous execution
                // (coordinator mode requested but task too small to split)
            }
            else {
                const results = [];
                for (const st of subTasks) {
                    const subAgent = resolveToAgent(st.agentId);
                    if (!subAgent) {
                        results.push(`[${st.agentId}] Skipped — agent not found`);
                        continue;
                    }
                    try {
                        // S04: Increment spawn counter for each coordinator sub-agent
                        context.session.agentSpawnCount++;
                        const subResult = await runAgent({
                            definition: subAgent,
                            task: st.description,
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
                        const scratchpadPath = writeScratchpadArtifact(coach, st.agentId, subResult.summary || 'No output');
                        results.push(`[${st.agentId}] Completed — written to ${scratchpadPath}`);
                    }
                    catch (err) {
                        results.push(`[${st.agentId}] Failed: ${err.message}`);
                    }
                }
                const allResults = readScratchpadArtifacts(coach);
                // Bug fix: detect when all sub-tasks failed — set isError so caller can react
                const allFailed = results.every(r => r.includes('Failed:') || r.includes('Skipped'));
                return {
                    toolCallId: '',
                    output: { summary: allResults.slice(0, 20000) },
                    content: [
                        `**Coordinator: ${input.description}**`,
                        '',
                        `Decomposed into ${subTasks.length} sub-tasks:`,
                        ...subTasks.map(st => `- ${st.agentId}: ${st.description} -- ${st.status}`),
                        '',
                        '---',
                        allResults.slice(0, 15000),
                    ].join('\n'),
                    isError: allFailed,
                };
            }
        }
        // ── Background (async fire-and-forget) ──
        if (run_in_background || agent.background) {
            // S04: Increment spawn counter to prevent infinite nesting
            context.session.agentSpawnCount++;
            // Background tasks use their own abort controller (independent from parent)
            const bgAbortController = new AbortController();
            const instanceId = instance?.id;
            const instanceMgr = mgr;
            // Fire-and-forget — don't await
            // P1 fix: 5-minute timeout auto-cancel for background agents
            const BG_AGENT_TIMEOUT_MS = 5 * 60 * 1000;
            const bgTimeout = setTimeout(() => {
                if (!bgAbortController.signal.aborted) {
                    bgAbortController.abort();
                }
            }, BG_AGENT_TIMEOUT_MS);
            runAgent({
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
                abortSignal: bgAbortController.signal,
            }).then((result) => {
                clearTimeout(bgTimeout);
                if (instanceId && instanceMgr) {
                    instanceMgr.markDone(instanceId, result.summary || 'Completed', result.turns || 0);
                }
                if (result.truncated) {
                    console.warn(`[AgentTool] Background subagent "${subagent_type}" truncated at ${result.turns} turns`);
                }
            }).catch((err) => {
                clearTimeout(bgTimeout);
                if (instanceId && instanceMgr) {
                    instanceMgr.markError(instanceId, err.message);
                }
                console.error(`[AgentTool] Background subagent "${subagent_type}" failed:`, err.message);
            });
            return {
                toolCallId: '',
                output: { summary: `[Background] ${subagent_type} spawned: ${description}` },
                content: `✅ Subagent "${subagent_type}" spawned in background: ${description}`,
            };
        }
        // ── Synchronous execution ──
        try {
            // S04: Increment spawn counter to prevent infinite nesting
            context.session.agentSpawnCount++;
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
            if (instance && mgr)
                mgr.markDone(instance.id, result.summary || 'Completed', result.turns || 0);
            return {
                toolCallId: '',
                output: { summary: result.summary },
                content: result.summary,
            };
        }
        catch (err) {
            if (instance && mgr)
                mgr.markError(instance.id, err.message);
            return {
                toolCallId: '',
                output: { summary: '' },
                content: `[Error] Subagent ${subagent_type} failed: ${err.message}`,
                isError: true,
            };
        }
    },
});
// ── Agent Resolution ──
/** Check if .codesquad agents have been loaded into cache. */
function _agentsLoaded() {
    return listAgents().length > 0;
}
/** Look up agent by type — checks built-ins first, then .codesquad. */
function resolveToAgent(subagentType) {
    switch (subagentType) {
        case 'explore': return exploreAgent;
        case 'sanity-check': return sanityCheckAgent;
        case 'fix': return fixAgent;
        case 'refactor': return refactorAgent;
        case 'test': return testAgent;
        case 'general-purpose': return generalPurposeAgent;
        default: return findAgent(subagentType);
    }
}
//# sourceMappingURL=AgentTool.js.map