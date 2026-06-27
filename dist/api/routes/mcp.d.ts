/**
 * MCP routes — query MCP server and tool status.
 *
 * GET /api/mcp/status  → connected MCP servers + tool counts
 * GET /api/mcp/tools   → all MCP tools with metadata
 */
import type { Express } from 'express';
import type { ApiServerConfig } from '../server.js';
export declare function registerMCPRoutes(app: Express, _config: ApiServerConfig): void;
//# sourceMappingURL=mcp.d.ts.map