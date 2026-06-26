/**
 * MCP routes — query MCP server and tool status.
 *
 * GET /api/mcp/status  → connected MCP servers + tool counts
 * GET /api/mcp/tools   → all MCP tools with metadata
 */
import { getToolPool } from '../../tools/registry.js';
/**
 * Extract MCP server status from the tool pool.
 * MCP tools are identified by `mcp__<server>__<tool>` naming convention.
 */
function getMCPServers() {
    const pool = getToolPool();
    const serverMap = new Map();
    for (const tool of pool) {
        if (!tool.name.startsWith('mcp__'))
            continue;
        // mcp__serverName__toolName → { serverName, toolName }
        const parts = tool.name.split('__');
        if (parts.length < 3)
            continue;
        const serverName = parts[1];
        const toolName = parts.slice(2).join('__');
        if (!serverMap.has(serverName)) {
            serverMap.set(serverName, { tools: [] });
        }
        serverMap.get(serverName).tools.push(toolName);
    }
    return Array.from(serverMap.entries()).map(([name, info]) => ({
        name,
        toolCount: info.tools.length,
        tools: info.tools.sort(),
    }));
}
export function registerMCPRoutes(app, _config) {
    // MCP server status
    app.get('/api/mcp/status', (_req, res) => {
        try {
            const servers = getMCPServers();
            res.json({
                connected: servers.length > 0,
                servers,
                totalServers: servers.length,
                totalTools: servers.reduce((sum, s) => sum + s.toolCount, 0),
            });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to query MCP status', code: 500 });
        }
    });
    // MCP tools list
    app.get('/api/mcp/tools', (_req, res) => {
        try {
            const pool = getToolPool();
            const mcpTools = pool
                .filter((t) => t.name.startsWith('mcp__'))
                .map((t) => ({
                fullName: t.name,
                server: t.name.split('__')[1] || 'unknown',
                toolName: t.name.split('__').slice(2).join('__'),
                description: t.description,
                isReadOnly: t.isReadOnly(),
            }));
            res.json({ tools: mcpTools, count: mcpTools.length });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to list MCP tools', code: 500 });
        }
    });
}
//# sourceMappingURL=mcp.js.map