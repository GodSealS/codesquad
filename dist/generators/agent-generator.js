// Agent Generator
//
// Reads canonical agent definitions from agents/{name}.md and generates
// tool-specific files via adapters.
//
// Supports two modes:
//   Dev mode: reads .md files from .codesquad/agents/ on disk
//   Embedded mode (Bun compile): reads from in-memory string constants
import { readdirSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { readAgentMd, parseAgentMd } from '../schemas/agent.schema.js';
import { resolveModel } from './model-resolver.js';
import { isEmbeddedMode, readAicoreFile, readAicoreDir } from '../core/paths.js';
/** Scan agents/ directory and parse all agent definitions */
export async function loadAgents(cliAgentsDir) {
    // ── Embedded mode: read from in-memory constants ──
    if (isEmbeddedMode()) {
        const agents = [];
        const entries = readAicoreDir('agents').filter((e) => e.endsWith('.md'));
        for (const entry of entries) {
            const content = readAicoreFile(`agents/${entry}`);
            if (!content)
                continue;
            try {
                const agent = parseAgentMd(content, entry);
                agents.push(agent);
            }
            catch (err) {
                console.error(`Warning: failed to parse agent ${entry}:`, err.message);
            }
        }
        return agents;
    }
    // ── Dev mode: read from disk ──
    const agentsDir = join(cliAgentsDir, 'agents');
    let entries;
    try {
        entries = readdirSync(agentsDir);
    }
    catch {
        return [];
    }
    const agents = [];
    for (const entry of entries) {
        if (!entry.endsWith('.md'))
            continue;
        const filePath = join(agentsDir, entry);
        try {
            const agent = readAgentMd(filePath);
            agents.push(agent);
        }
        catch (err) {
            console.error(`Warning: failed to parse agent ${filePath}:`, err.message);
        }
    }
    return agents;
}
/**
 * Generate agent files for a single tool adapter.
 */
export function generateAgents(adapter, agents, outputDir, modelsConfig) {
    const errors = [];
    let count = 0;
    for (const agent of agents) {
        try {
            const effectiveModel = resolveModel(agent.model, agent.name, 'agent', modelsConfig);
            const targetPath = join(outputDir, adapter.getAgentPath(agent.name));
            const content = adapter.formatAgent(agent, effectiveModel);
            mkdirSync(dirname(targetPath), { recursive: true });
            writeFileSync(targetPath, content, 'utf-8');
            count++;
        }
        catch (err) {
            errors.push(`Agent ${agent.name}: ${err.message}`);
        }
    }
    return { count, errors };
}
//# sourceMappingURL=agent-generator.js.map