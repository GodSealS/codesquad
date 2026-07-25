/**
 * MCP Configuration API — GET/POST endpoints for Web UI ↔ .codesquad/settings.json sync.
 *
 * GET  /api/mcp/servers   → Return current mcpServers block from .codesquad/settings.json
 * POST /api/mcp/servers   → Write mcpServers config from UI to .codesquad/settings.json
 */
import type http from 'http';
import type { ToolRegistry } from '../../tools/ToolRegistry.js';
import type { MCPBridge } from '../../tools/MCPBridge.js';
/**
 * GET /api/mcp/servers
 * Returns the current mcpServers configuration from .codesquad/settings.json.
 */
export declare function handleMcpGet(_req: http.IncomingMessage, res: http.ServerResponse, aicoreDir: string): Promise<void>;
/**
 * POST /api/mcp/servers
 * Body: { mcpServers: Record<string, McpServerEntry> }
 * Writes the MCP servers configuration into .codesquad/settings.json.
 */
export declare function handleMcpPost(req: http.IncomingMessage, res: http.ServerResponse, aicoreDir: string): Promise<void>;
/**
 * POST /api/mcp/reload
 * Hot-reload MCP tools from .codesquad/settings.json without server restart.
 */
export declare function handleMcpReload(_req: http.IncomingMessage, res: http.ServerResponse, aicoreDir: string, toolRegistry?: ToolRegistry, mcpBridge?: MCPBridge): Promise<void>;
/**
 * POST /api/mcp/verify
 * Body: { url, type }
 * Tests connectivity to an MCP server endpoint.
 * Returns { ok: true } on success or { ok: false, error } on failure.
 */
export declare function handleMcpVerify(req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
export interface McpServerStatus {
    name: string;
    type: string;
    url?: string;
    command?: string;
    disabled?: boolean;
    connected: boolean;
    error?: string;
    lastChecked: string;
}
/**
 * GET /api/mcp/status
 * Returns connection status for all configured MCP servers.
 * Called by the Web UI on page load and every 60s for heartbeat.
 */
export declare function handleMcpStatus(_req: http.IncomingMessage, res: http.ServerResponse, aicoreDir: string): Promise<void>;
export interface QmdStatus {
    installed: boolean;
    version?: string;
    command?: string;
    configuredAsMcp: boolean;
    mcpServerName?: string;
    message: string;
}
/**
 * GET /api/qmd/status
 * Checks whether the qmd CLI is installed on the system, and whether
 * it's already configured as an MCP server in .codesquad/settings.json.
 */
export declare function handleQmdStatus(_req: http.IncomingMessage, res: http.ServerResponse, aicoreDir: string): Promise<void>;
//# sourceMappingURL=mcp.d.ts.map