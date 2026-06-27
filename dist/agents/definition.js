/**
 * Agent definition system — loads and manages agent configs.
 *
 * Supports three-layer loading: Project > User > AICore.
 *
 * Embedded mode (Bun compile): Layer 1 (AICore built-in) reads from
 * in-memory string constants instead of disk.
 *
 * References:
 *   Claude Code src/tools/AgentTool/loadAgentsDir.ts (26KB)
 *
 * Phase 6.0
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { getCodeSquadProjectCategory, getCodeSquadUserCategory, isEmbeddedMode, readAicoreFile, readAicoreDir } from '../core/paths.js';
// ── Cache ──
const _agentsCache = new Map();
let _activeCacheKey = null;
// ── Loader ──
/**
 * Load all agents from a single directory.
 * Parses YAML frontmatter + Markdown body.
 */
export function loadAllAgents(agentsDir) {
    const key = `agents:${agentsDir}`;
    const cached = _agentsCache.get(key);
    if (cached)
        return cached;
    const agents = [];
    try {
        const files = readdirSync(agentsDir).filter((f) => f.endsWith('.md'));
        for (const file of files) {
            const filePath = join(agentsDir, file);
            try {
                const raw = readFileSync(filePath, 'utf-8');
                const parsed = parseAgentFile(raw, file.replace('.md', ''));
                if (parsed) {
                    agents.push(parsed);
                }
            }
            catch {
                // Skip unreadable agents
            }
        }
    }
    catch {
        // Directory may not exist
    }
    _agentsCache.set(key, agents);
    _activeCacheKey = key;
    return agents;
}
/**
 * Load agents from two layers (Project .codesquad/ > User AICore/).
 * Override semantics: same-named agent from project wins.
 *
 * In embedded mode, Layer 1 reads from in-memory constants.
 */
export function loadAllAgentsLayered(aicoreRoot, cwd) {
    const key = `layered:${aicoreRoot}:${cwd ?? ''}`;
    const cached = _agentsCache.get(key);
    if (cached)
        return cached;
    const seen = new Map();
    // Layer 1: AICore/agents/ (built-in, base)
    // Embedded mode: read from in-memory constants
    // Dev mode: read from disk
    if (isEmbeddedMode()) {
        const entries = readAicoreDir('agents').filter((e) => e.endsWith('.md'));
        for (const entry of entries) {
            const content = readAicoreFile(`agents/${entry}`);
            if (!content)
                continue;
            const parsed = parseAgentFile(content, entry.replace('.md', ''));
            if (parsed) {
                parsed.layer = 'user';
                seen.set(parsed.agentType, parsed);
            }
        }
    }
    else {
        for (const agent of loadAgentsFromDir(join(aicoreRoot, 'agents'), 'user')) {
            seen.set(agent.agentType, agent);
        }
    }
    // Layer 2: ~/.codesquad/agents/ (user-home, override — external tools install here)
    for (const agent of loadAgentsFromDir(getCodeSquadUserCategory('agents'), 'user')) {
        seen.set(agent.agentType, agent);
    }
    // Layer 3: ${project}/.codesquad/agents/ (project-level, final override)
    for (const agent of loadAgentsFromDir(getCodeSquadProjectCategory('agents', cwd), 'project')) {
        seen.set(agent.agentType, agent);
    }
    const result = Array.from(seen.values());
    _agentsCache.set(key, result);
    _activeCacheKey = key;
    return result;
}
function loadAgentsFromDir(dir, layer) {
    const agents = [];
    try {
        const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
        for (const file of files) {
            const filePath = join(dir, file);
            try {
                const raw = readFileSync(filePath, 'utf-8');
                const parsed = parseAgentFile(raw, file.replace('.md', ''));
                if (parsed) {
                    parsed.layer = layer;
                    parsed.sourcePath = filePath;
                    agents.push(parsed);
                }
            }
            catch {
                // Skip unreadable agents
            }
        }
    }
    catch {
        // Directory may not exist
    }
    return agents;
}
/**
 * Parse an agent Markdown file.
 * Extracts YAML frontmatter fields: name, description, tools, model, agentMode, maxTurns, skills, disallowedTools
 */
function parseAgentFile(raw, filename) {
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    const fm = fmMatch ? fmMatch[1] : '';
    const body = fmMatch ? raw.slice(raw.indexOf('---\n', 4) + 4).trim() : raw;
    const name = extractField(fm, 'name') || filename;
    const description = extractField(fm, 'description') || `${name} agent`;
    // Parse tools
    const toolsRaw = extractField(fm, 'tools');
    const tools = toolsRaw
        ? toolsRaw.split(',').map((t) => t.trim()).filter(Boolean)
        : undefined;
    // Parse disallowed tools
    const disallowedRaw = extractField(fm, 'disallowedTools');
    const disallowedTools = disallowedRaw
        ? disallowedRaw.split(',').map((t) => t.trim()).filter(Boolean)
        : [];
    // Parse model
    const model = extractField(fm, 'model');
    // Parse maxTurns
    const maxTurnsRaw = extractField(fm, 'maxTurns');
    const maxTurns = maxTurnsRaw ? parseInt(maxTurnsRaw, 10) : 20;
    // Parse agentMode → permissionMode
    const agentMode = extractField(fm, 'agentMode');
    const permissionMode = agentMode === 'agentic'
        ? 'default'
        : undefined;
    // Parse subagent flag
    const subagentRaw = extractField(fm, 'subagent');
    const subagent = subagentRaw === 'true';
    return {
        agentType: name,
        whenToUse: description.slice(0, 200),
        prompt: body,
        tools,
        disallowedTools,
        permissionMode,
        maxTurns: isNaN(maxTurns) ? 20 : maxTurns,
        model,
        background: false,
        subagent,
    };
}
// ── Helpers ──
function extractField(fm, field) {
    const match = fm.match(new RegExp(`^${field}\\s*:\\s*(.+)$`, 'm'));
    if (!match)
        return undefined;
    return match[1].trim().replace(/^["']|["']$/g, '');
}
// ── Query ──
/** Find an agent by name. */
export function findAgent(name) {
    const agents = _activeCacheKey ? _agentsCache.get(_activeCacheKey) : undefined;
    if (!agents)
        return undefined;
    return agents.find((a) => a.agentType === name);
}
/** List all loaded agents. */
export function listAgents() {
    if (!_activeCacheKey)
        return [];
    return _agentsCache.get(_activeCacheKey) || [];
}
/** Invalidate agent cache. */
export function invalidateAgentCache() {
    _agentsCache.clear();
    _activeCacheKey = null;
}
//# sourceMappingURL=definition.js.map