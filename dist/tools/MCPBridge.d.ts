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
type MCPToolHandler = (input: Record<string, unknown>) => Promise<unknown>;
/** Runtime-owned MCP handler registry and tool-wrapper factory. */
export declare class MCPBridge {
    private toolHandlers;
    registerMCPToolHandler(serverName: string, toolName: string, handler: MCPToolHandler): void;
    unregisterMCPServer(serverName: string): void;
    clear(): void;
    /** Create a wrapper bound to this bridge's handler registry. */
    createMCPToolWrapper(def: MCPToolDefinition, serverName: string): Tool;
    private invokeMCPTool;
}
export declare function createMCPToolWrapper(def: MCPToolDefinition, serverName: string): Tool;
export declare function registerMCPToolHandler(serverName: string, toolName: string, handler: MCPToolHandler): void;
export declare function unregisterMCPServer(serverName: string): void;
export {};
//# sourceMappingURL=MCPBridge.d.ts.map