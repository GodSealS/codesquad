/**
 * Coordinator Mode — Multi-agent orchestration engine.
 *
 * Inspired by Claude Code's coordinatorMode.ts (18.93 KB).
 * A coordinator agent decomposes a user task into sub-tasks, dispatches them to
 * specialist sub-agents in parallel, and synthesizes results.
 *
 * Phase 5 — Chat Feature Gap Fill
 */
import { join } from 'path';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
// ── Agent‑selection heuristic ──
const CATEGORY_AGENT_MAP = {
    design: ['game-designer', 'creative-director', 'systems-designer', 'level-designer', 'economy-designer', 'ux-designer', 'art-director', 'narrative-director'],
    programming: ['ai-programmer', 'engine-programmer', 'gameplay-programmer', 'network-programmer', 'ui-programmer', 'tools-programmer'],
    qa: ['qa-lead', 'qa-tester', 'performance-analyst', 'security-engineer'],
    production: ['producer', 'technical-director', 'lead-programmer', 'release-manager', 'devops-engineer'],
    content: ['writer', 'sound-designer', 'world-builder', 'audio-director', 'technical-artist'],
    engine: ['unreal-specialist', 'unity-specialist', 'godot-specialist', 'cocos-specialist'],
};
function selectAgentForTask(taskDescription, excludeAgents) {
    const lower = taskDescription.toLowerCase();
    for (const [category, agents] of Object.entries(CATEGORY_AGENT_MAP)) {
        const available = agents.filter(a => !excludeAgents.has(a));
        if (available.length === 0)
            continue;
        if (category === 'design' && /\b(design|layout|balance|economy|ux|ui|narrative|story|level|world|art|visual)\b/i.test(lower))
            return available[0];
        if (category === 'programming' && /\b(code|implement|program|engine|network|optimize|refactor|function|class|api|algorithm|render|shader)\b/i.test(lower))
            return available[0];
        if (category === 'qa' && /\b(test|qa|bug|regression|perf|performance|security|vuln|exploit)\b/i.test(lower))
            return available[0];
        if (category === 'content' && /\b(write|document|audio|sound|music|dialogue|lore|translat|localiz)\b/i.test(lower))
            return available[0];
        if (category === 'engine' && /\b(unreal|unity|godot|cocos|blueprint|shader|asset pipeline|build system)\b/i.test(lower))
            return available[0];
    }
    // Fallback: pick first unassigned agent from any category
    for (const agents of Object.values(CATEGORY_AGENT_MAP)) {
        const available = agents.filter(a => !excludeAgents.has(a));
        if (available.length > 0)
            return available[0];
    }
    return null;
}
// ── Coordinator Engine ──
export function createCoordinatorContext(session, projectRoot) {
    // Use an agent‑scoped scratchpad directory that persists across startup calls
    const scratchpadDir = join(projectRoot, '.codebuddy', 'scratchpad', session.id);
    if (!existsSync(scratchpadDir)) {
        mkdirSync(scratchpadDir, { recursive: true });
    }
    return {
        scratchpadDir,
        subTasks: new Map(),
        collectedResults: [],
    };
}
/**
 * Decompose a user task into sub‑tasks aligned with available specialist agents.
 *
 * The decomposition is heuristic (keyword‑based); a full implementation would
 * offload this to the LLM itself (coordinator LLM call). This provides a
 * fast default that avoids an extra model round trip.
 */
export function decomposeTask(task, coach, options) {
    const excludeSet = new Set();
    const subTasks = [];
    const MAX = Math.min(options.maxSubAgents, Object.values(CATEGORY_AGENT_MAP).reduce((s, a) => s + a.length, 0));
    // Category‑aware decomposition
    const designPatterns = /\b(design|layout|balance|economy|ux|ui|narrative|story|level|world|art|visual)\b/gi;
    const codePatterns = /\b(code|implement|program|engine|network|optimize|refactor|function|class|api|algorithm|render|shader|logic|mechanic)\b/gi;
    const testPatterns = /\b(test|qa|bug|regression|perf|performance|security|vuln|exploit)\b/gi;
    const contentPatterns = /\b(write|document|audio|sound|music|dialogue|lore|translat|localiz|tutorial|manual)\b/gi;
    let added = 0;
    const tryAdd = (category, pattern, label) => {
        if (added >= MAX)
            return;
        const match = task.match(pattern);
        if (match && match.length >= 2) {
            const agent = selectAgentForTask(category, excludeSet);
            if (agent) {
                excludeSet.add(agent);
                subTasks.push({ id: randomUUID(), agentId: agent, description: `${label}: ${match.slice(0, 3).join(', ')}`, status: 'pending' });
                coach.subTasks.set(agent, subTasks[subTasks.length - 1]);
                added++;
            }
        }
    };
    tryAdd('design', designPatterns, 'Design aspects');
    tryAdd('programming', codePatterns, 'Implementation tasks');
    tryAdd('qa', testPatterns, 'Testing & QA');
    tryAdd('content', contentPatterns, 'Content & documentation');
    // If no specific category matched, decompose by sentence segments into at most 3 chunks
    if (subTasks.length === 0) {
        const sentences = task.split(/[.。!！?？\n]+/).filter(s => s.trim().length > 10);
        const chunkSize = Math.ceil(sentences.length / Math.min(3, MAX));
        for (let i = 0; i < sentences.length && added < MAX; i += chunkSize) {
            const agent = selectAgentForTask('general', excludeSet);
            if (!agent)
                break;
            excludeSet.add(agent);
            subTasks.push({
                id: randomUUID(),
                agentId: agent,
                description: sentences.slice(i, i + chunkSize).join('; ').trim(),
                status: 'pending',
            });
            coach.subTasks.set(agent, subTasks[subTasks.length - 1]);
            added++;
        }
    }
    return subTasks;
}
/**
 * Build a coordinator system prompt that describes available sub‑agents
 * and the scratchpad workflow.
 */
export function buildCoordinatorPrompt(subTasks, scratchpadDir) {
    const taskList = subTasks
        .map(st => `  - **${st.agentId}**: ${st.description}`)
        .join('\n');
    return [
        '[MODE: COORDINATOR — MULTI-AGENT ORCHESTRATION]',
        '',
        'You are acting as a coordinator. Your job is to:',
        '1. Analyze the user\'s request and decompose it into sub-tasks.',
        '2. Dispatch each sub-task to a specialist agent using the Agent tool.',
        '3. Collect and synthesize the results.',
        '',
        '## Available Specialist Agents',
        taskList,
        '',
        '## Scratchpad',
        `Use the Read/Write/Edit tools to share intermediate work via \`${scratchpadDir}/\`.`,
        'Each sub-agent writes its output to this directory. Read it back to synthesize.',
        '',
        '## Rules',
        '- Dispatch sub-tasks using `Agent(agentName, prompt)` for each specialist.',
        '- After all agents complete, synthesize their results into a final answer.',
        '- Never run more than 3 sub-agents simultaneously unless asked.',
        '',
    ].join('\n');
}
/**
 * Write a sub‑agent's output to the scratchpad for the coordinator to read.
 */
export function writeScratchpadArtifact(coach, agentId, content) {
    const filePath = join(coach.scratchpadDir, `${agentId}.md`);
    writeFileSync(filePath, `# ${agentId} Output\n\n${content}`, 'utf-8');
    coach.collectedResults.push(`[${agentId}]\n${content}`);
    return filePath;
}
/**
 * Read all scratchpad artifacts for synthesis.
 */
export function readScratchpadArtifacts(coach) {
    if (coach.collectedResults.length === 0)
        return 'No sub-agent results yet.';
    return coach.collectedResults.join('\n\n---\n\n');
}
/**
 * Mark a sub‑task as complete and write its result.
 */
export function completeSubTask(coach, agentId, output, isError) {
    const st = coach.subTasks.get(agentId);
    if (st) {
        st.status = isError ? 'error' : 'done';
        st.output = output;
        if (isError)
            st.error = output;
    }
    if (output) {
        writeScratchpadArtifact(coach, agentId, output);
    }
}
//# sourceMappingURL=coordinator.js.map