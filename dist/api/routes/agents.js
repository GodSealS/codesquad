/**
 * Agent routes — serves agent list/detail from .codesquad/agents/*.md.
 *
 * Replaces UI's static /docs/agents.json with live .codesquad data.
 *
 * GET /api/agents        → list all agents
 * GET /api/agents/:name  → single agent prompt + frontmatter
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { getCodeSquadProjectCategory, getCodeSquadUserCategory } from '../../core/paths.js';
function extractFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
        return { data: {}, body: content };
    }
    try {
        const data = (parseYaml(match[1]) || {});
        return { data, body: match[2].trim() };
    }
    catch {
        return { data: {}, body: content };
    }
}
function listAgents(aicoreDir) {
    const seen = new Map();
    // Layer 1: .codesquad/agents/ (built-in, base)
    scanAgentDirToList(join(aicoreDir, 'agents'), seen);
    // Layer 2: ~/.codesquad/agents/ (user-home, override)
    scanAgentDirToList(getCodeSquadUserCategory('agents'), seen);
    // Layer 3: ${project}/.codesquad/agents/ (project-level, final override)
    scanAgentDirToList(getCodeSquadProjectCategory('agents'), seen);
    return Array.from(seen.values());
}
function scanAgentDirToList(dir, seen) {
    if (!existsSync(dir))
        return;
    try {
        const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
        for (const f of files) {
            const name = f.replace('.md', '');
            if (seen.has(name))
                continue;
            const content = readFileSync(join(dir, f), 'utf-8');
            const { data: fm } = extractFrontmatter(content);
            seen.set(name, {
                id: name,
                name: fm.name || name,
                description: fm.description || '',
                category: fm.category || 'general',
                tags: fm.tags || [],
                model: fm.model || null,
            });
        }
    }
    catch { /* skip unreadable dir */ }
}
function getAgentDetail(aicoreDir, name) {
    const agentPath = join(aicoreDir, 'agents', `${name}.md`);
    if (!existsSync(agentPath))
        return null;
    const content = readFileSync(agentPath, 'utf-8');
    const { data: fm, body } = extractFrontmatter(content);
    return {
        id: name,
        name: fm.name || name,
        description: fm.description || '',
        category: fm.category || 'general',
        tags: fm.tags || [],
        model: fm.model || null,
        prompt: body,
        fullPath: agentPath,
    };
}
export function registerAgentRoutes(app, config) {
    app.get('/api/agents', (_req, res) => {
        try {
            const agents = listAgents(config.aicoreDir);
            res.json({ agents, count: agents.length });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to list agents', code: 500 });
        }
    });
    app.get('/api/agents/:name', (req, res) => {
        try {
            const agent = getAgentDetail(config.aicoreDir, String(req.params.name));
            if (!agent) {
                res.status(404).json({ error: `Agent not found: ${req.params.name}`, code: 404 });
                return;
            }
            res.json(agent);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to load agent', code: 500 });
        }
    });
}
//# sourceMappingURL=agents.js.map