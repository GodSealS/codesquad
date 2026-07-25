import type { Tool } from './types.js';
/**
 * Runtime-owned tool registry.
 *
 * This intentionally coexists with registry.ts during the staged migration so
 * callers can move one registration/read path at a time without changing the
 * current process-global tool pool.
 */
export declare class ToolRegistry {
    private toolPool;
    private mcpTools;
    registerTools(tools: readonly Tool[]): void;
    registerTool(tool: Tool): void;
    /**
     * Register an MCP wrapper, replacing an existing wrapper with the same name.
     * Reloading a server must not accumulate stale or duplicate MCP tools.
     */
    mcpRegister(tool: Tool): void;
    getToolPool(): readonly Tool[];
    findTool(name: string): Tool | undefined;
    clear(): void;
    unregisterByPrefix(prefix: string): number;
}
//# sourceMappingURL=ToolRegistry.d.ts.map