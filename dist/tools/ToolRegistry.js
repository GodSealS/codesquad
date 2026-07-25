/**
 * Runtime-owned tool registry.
 *
 * This intentionally coexists with registry.ts during the staged migration so
 * callers can move one registration/read path at a time without changing the
 * current process-global tool pool.
 */
export class ToolRegistry {
    toolPool = [];
    mcpTools = new Map();
    registerTools(tools) {
        this.toolPool = [...tools];
    }
    registerTool(tool) {
        this.toolPool.push(tool);
    }
    /**
     * Register an MCP wrapper, replacing an existing wrapper with the same name.
     * Reloading a server must not accumulate stale or duplicate MCP tools.
     */
    mcpRegister(tool) {
        this.mcpTools.set(tool.name, tool);
    }
    getToolPool() {
        return Object.freeze([...this.toolPool, ...this.mcpTools.values()]);
    }
    findTool(name) {
        return this.getToolPool().find((tool) => tool.name === name)
            ?? this.getToolPool().find((tool) => tool.aliases?.includes(name));
    }
    clear() {
        this.toolPool = [];
        this.mcpTools.clear();
    }
    unregisterByPrefix(prefix) {
        const before = this.toolPool.length + this.mcpTools.size;
        this.toolPool = this.toolPool.filter((tool) => !tool.name.startsWith(prefix));
        for (const name of this.mcpTools.keys()) {
            if (name.startsWith(prefix))
                this.mcpTools.delete(name);
        }
        return before - this.toolPool.length - this.mcpTools.size;
    }
}
//# sourceMappingURL=ToolRegistry.js.map