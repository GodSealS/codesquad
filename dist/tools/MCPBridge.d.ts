/**
 * MCP Bridge — wraps MCP tools as CodeSquad Tool instances.
 *
 * Connects existing src/mcp/ infrastructure to the Chat tool pool.
 * MCP tools appear alongside built-in tools in the tool registry.
 *
 * References:
 *   Claude Code src/tools/MCPTool.ts
 *
 * Phase 7.0
 */
import { type Tool } from './types.js';
export interface MCPToolDefinition {
    name: string;
    description: string;
    inputSchema?: Record<string, unknown>;
}
/**
 * Create a CodeSquad Tool wrapper for an MCP tool.
 * The tool name is prefixed with "mcp__" to prevent collisions.
 */
export declare function createMCPToolWrapper(def: MCPToolDefinition, serverName: string): Tool;
/**
 * Register an MCP tool handler.
 * Called by the MCP client when tools are discovered.
 */
export declare function registerMCPToolHandler(serverName: string, toolName: string, handler: (input: Record<string, unknown>) => Promise<unknown>): void;
/**
 * Remove all handlers for a server (on disconnect).
 */
export declare function unregisterMCPServer(serverName: string): void;
//# sourceMappingURL=MCPBridge.d.ts.map