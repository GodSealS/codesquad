/**
 * Agents & Skills API — list, detail, search.
 * Scans three layers: Project (.codesquad/) > User (~/.codesquad/) > .codesquad/
 *
 * .codesquad layer uses VirtualFS so it works both from embedded binary and disk.
 */
import { join } from 'path';
import { getCodeSquadUserCategory } from '../../core/paths.js';
import { virtualExists, virtualReadFile, virtualReadDir, AICORE_ROOT } from '../../embedded/virtual-fs.js';
// Use canonical path from virtual-fs.ts (handles Bun-compiled correctly)
const AICORE_DIR = AICORE_ROOT;
/** Get project-level .codesquad directory. */
function getProjectCodeSquadDir() {
    return join(process.cwd(), '.codesquad');
}
/** Scan a directory for agents, return map keyed by name. VirtualFS handles both embedded and disk. */
function scanAgentDir(dir, layer) {
    const map = new Map();
    const entries = virtualReadDir(dir);
    for (const f of entries) {
        if (!f.endsWith('.md') || f === 'manifest.yaml')
            continue;
        const agentName = f.replace('.md', '');
        const fullPath = join(dir, f);
        let content;
        try {
            content = virtualReadFile(fullPath, 'utf-8');
        }
        catch {
            continue;
        }
        const tags = extractTags(content);
        map.set(agentName, {
            id: agentName,
            name: agentName,
            description: extractFrontmatterField(content, 'description') || extractDescription(content),
            description_cn: extractFrontmatterField(content, 'description_cn') || extractFrontmatterField(content, 'description'),
            tags,
            sizeBytes: Buffer.byteLength(content),
            layer,
        });
    }
    return map;
}
/** Scan a directory for skills, return map keyed by name. VirtualFS handles both embedded and disk. */
function scanSkillDir(dir, layer) {
    const map = new Map();
    const subdirs = virtualReadDir(dir);
    for (const skillName of subdirs) {
        const skillPath = join(dir, skillName, 'SKILL.md');
        if (!virtualExists(skillPath))
            continue;
        try {
            const content = virtualReadFile(skillPath, 'utf-8');
            const description = extractFrontmatterField(content, 'description') || extractDescription(content);
            const descriptionCn = extractFrontmatterField(content, 'description_cn') || description;
            const sizeBytes = Buffer.byteLength(content);
            let userInvocable = true;
            const uim = content.match(/user-invocable:\s*(true|false)/i);
            if (uim)
                userInvocable = uim[1].toLowerCase() === 'true';
            map.set(skillName, {
                id: skillName,
                name: skillName,
                description,
                description_cn: descriptionCn,
                sizeBytes,
                userInvocable,
                layer,
            });
        }
        catch { /* skip corrupted */ }
    }
    return map;
}
/** Merge layered maps: later layers override earlier ones. */
function mergeMaps(base, override) {
    const merged = new Map(base);
    for (const [key, val] of override) {
        merged.set(key, val);
    }
    return merged;
}
/** Extract a short description from an agent/skill markdown file. */
function extractDescription(content) {
    const body = content.replace(/^---[\s\S]*?---\n*/m, '').trim();
    const lines = body.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('>') && trimmed.length > 10) {
            return trimmed.slice(0, 120) + (trimmed.length > 120 ? '…' : '');
        }
    }
    return '';
}
/** Extract a frontmatter field value (supports quoted and unquoted). */
function extractFrontmatterField(content, field) {
    const re = new RegExp(`${field}:\\s*"?([^"\\n]+)"?`, 'im');
    const m = content.match(re);
    return m?.[1]?.trim() || '';
}
function extractTags(content) {
    const tagMatch = content.match(/tags:\s*\[([^\]]+)\]/im)
        ?? content.match(/tags:\s*\n\s*-\s*(\w+)/gm);
    if (!tagMatch)
        return [];
    const raw = tagMatch[0].replace(/tags:\s*/, '').replace(/[\[\]\n\r]/g, '');
    return raw.split(',').map((t) => t.trim().replace(/^- /, '')).filter(Boolean);
}
export async function handleAgents(req, res, _services, path) {
    const name = path.slice('/api/agents'.length).replace(/^\/+/, '');
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const query = url.searchParams.get('q')?.toLowerCase();
    const tagFilter = url.searchParams.get('tags')?.toLowerCase();
    const agentsDir = join(AICORE_DIR, 'agents');
    // GET /api/agents/:name — full document
    if (name) {
        const filePath = join(agentsDir, `${name}.md`);
        if (!virtualExists(filePath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Agent not found' }));
            return;
        }
        const content = virtualReadFile(filePath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ name, content }));
        return;
    }
    // GET /api/agents — list (three-layer: project > user-home > aicore)
    try {
        let agentMap = scanAgentDir(join(AICORE_DIR, 'agents'), 'user');
        const homeMap = scanAgentDir(getCodeSquadUserCategory('agents'), 'user');
        agentMap = mergeMaps(agentMap, homeMap);
        const projectMap = scanAgentDir(join(getProjectCodeSquadDir(), 'agents'), 'project');
        agentMap = mergeMaps(agentMap, projectMap);
        let agents = Array.from(agentMap.values());
        if (query)
            agents = agents.filter((a) => a.name.toLowerCase().includes(query));
        if (tagFilter)
            agents = agents.filter((a) => a.tags.some((t) => t.toLowerCase().includes(tagFilter)));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ agents: agents.sort((a, b) => a.name.localeCompare(b.name)), total: agents.length }));
    }
    catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to list agents' }));
    }
}
export async function handleSkills(req, res, _services, path) {
    const name = path.slice('/api/skills'.length).replace(/^\/+/, '/').replace(/\/+$/, '');
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const query = url.searchParams.get('q')?.toLowerCase();
    const skillsDir = join(AICORE_DIR, 'skills');
    // GET /api/skills/:name — full document
    if (name) {
        const skillName = name.replace(/^\//, '');
        const filePath = join(skillsDir, skillName, 'SKILL.md');
        if (!virtualExists(filePath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Skill not found' }));
            return;
        }
        const content = virtualReadFile(filePath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ name: skillName, content }));
        return;
    }
    // GET /api/skills — list (three-layer: project > user-home > aicore)
    try {
        let skillMap = scanSkillDir(join(AICORE_DIR, 'skills'), 'user');
        const homeMap = scanSkillDir(getCodeSquadUserCategory('skills'), 'user');
        skillMap = mergeMaps(skillMap, homeMap);
        const projectMap = scanSkillDir(join(getProjectCodeSquadDir(), 'skills'), 'project');
        skillMap = mergeMaps(skillMap, projectMap);
        let skills = Array.from(skillMap.values());
        if (query)
            skills = skills.filter((s) => s.name.toLowerCase().includes(query));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ skills: skills.sort((a, b) => a.name.localeCompare(b.name)), total: skills.length }));
    }
    catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to list skills' }));
    }
}
//# sourceMappingURL=agents.js.map