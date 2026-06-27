/**
 * MCP Server — Discovery Tools
 *
 * Implements:
 *   - codesquad.status  — agent/skill counts, health, version
 *   - codesquad.search  — search agents and skills by keyword/tag
 */
import { loadAllStubs, searchStubs } from '../stub-loader.js';
/** Cached stub data — refreshed on demand */
let _cache = null;
function getCachedStubs() {
    if (!_cache) {
        _cache = loadAllStubs();
    }
    return _cache;
}
/** Invalidate cache (e.g., after init/update) */
export function invalidateStubCache() {
    _cache = null;
}
/** Build a simple text result */
function textResult(text, isError = false) {
    const content = { type: 'text', text };
    return { content: [content], isError };
}
/** Handle codesquad.status */
function handleStatus() {
    const { agents, skills } = getCachedStubs();
    const output = {
        server: 'codesquad-mcp',
        version: '0.1.0',
        protocol: '2024-11-05',
        agents: {
            total: agents.length,
        },
        skills: {
            total: skills.length,
            user_invocable: skills.filter(s => s.userInvocable !== false).length,
        },
        health: 'ok',
        timestamp: new Date().toISOString(),
    };
    return textResult(JSON.stringify(output, null, 2));
}
/** Handle codesquad.search */
function handleSearch(params) {
    if (!params || typeof params.query !== 'string') {
        return textResult(JSON.stringify({ error: 'Missing required parameter: query' }), true);
    }
    const query = params.query;
    const searchType = params.type ?? 'all';
    const { agents, skills } = getCachedStubs();
    const results = [];
    if (searchType === 'agent' || searchType === 'all') {
        const matchedAgents = searchStubs(agents, query);
        for (const a of matchedAgents) {
            results.push({
                type: 'agent',
                name: a.name,
                description: a.description,
                tags: a.tags,
                mode: a.mode,
                input: a.input,
                output: a.output,
            });
        }
    }
    if (searchType === 'skill' || searchType === 'all') {
        const matchedSkills = searchStubs(skills, query);
        for (const s of matchedSkills) {
            results.push({
                type: 'skill',
                name: s.name,
                description: s.description,
                tags: s.tags,
                user_invocable: s.userInvocable !== false,
            });
        }
    }
    return textResult(JSON.stringify({
        query,
        type: searchType,
        count: results.length,
        results,
    }, null, 2));
}
/** Tool name → handler mapping */
const DISCOVERY_HANDLERS = {
    'codesquad.status': handleStatus,
    'codesquad.search': handleSearch,
};
/** Discovery tool definitions for tools/list */
export const DISCOVERY_TOOLS = [
    {
        name: 'codesquad.status',
        description: 'Get CodeSquad server status: agent/skill counts, health, version',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'codesquad.search',
        description: 'Search agents and skills by keyword, tag, or capability',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query' },
                type: { type: 'string', enum: ['agent', 'skill', 'all'], default: 'all' },
            },
            required: ['query'],
        },
    },
];
/** Route a discovery tool call */
export function handleDiscoveryTool(toolName, params) {
    const handler = DISCOVERY_HANDLERS[toolName];
    if (!handler)
        return null;
    return handler(params);
}
//# sourceMappingURL=discovery-tools.js.map