/**
 * Tool registry — assembles tool pool, runs tool execution chain.
 *
 * References:
 *   Claude Code src/tools.ts — assembleToolPool()
 *   Claude Code src/tools/toolExecution.ts — runToolUse()
 *
 * Phase 1.7
 */
import type { Tool, ToolUseContext, ToolResult, ResolvedPermissionRule } from './types.js';
export declare function registerTools(tools: Tool[]): void;
export declare function registerTool(tool: Tool): void;
export declare function getToolPool(): readonly Tool[];
export declare function findTool(name: string): Tool | undefined;
export declare function clearToolPool(): void;
/** Remove tools matching a name prefix (e.g. "mcp__" to clear MCP tools before re-registration). */
export declare function unregisterToolsByPrefix(prefix: string): number;
export declare function setPermissionRules(rules: ResolvedPermissionRule[]): void;
export declare function addPermissionRule(rule: ResolvedPermissionRule): void;
export declare function clearPermissionRules(): void;
export interface RunToolOptions {
    toolName: string;
    rawInput: Record<string, unknown>;
    context: ToolUseContext;
}
/**
 * Complete tool execution chain:
 *   find → validateInput → PreToolUse hooks → permission pipeline → call → PostToolUse hooks
 *
 * Mirrors Claude Code's runToolUse() in toolExecution.ts.
 */
export declare function runToolUse(options: RunToolOptions): Promise<ToolResult>;
/**
 * Assemble the complete tool pool including MCP tools.
 * Mirrors Claude Code's `assembleToolPool()` in src/tools.ts.
 *
 * Merge order: built-in tools → MCP tools (from bridge) → dedup by name.
 */
export declare function assembleToolPool(context?: Partial<ToolUseContext>): readonly Tool[];
/**
 * Get dedup statistics for display in startup logs.
 */
export declare function getDedupStats(): {
    builtin: number;
    mcp: number;
    mcpDeduped: number;
};
/**
 * Generate tool descriptions for system prompt injection.
 * Only includes enabled tools.
 */
export declare function generateToolPrompts(context?: Partial<ToolUseContext>): string;
export declare function getToolStats(): {
    total: number;
    readOnly: number;
    destructive: number;
};
//# sourceMappingURL=registry.d.ts.map