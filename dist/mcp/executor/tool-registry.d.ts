/**
 * Tool Registry — Handler Registry
 *
 * Maps tool names to executable handlers.
 * Each handler receives arguments and workspace path, returns result.
 *
 * Safety:
 *   - All file paths validated against workspace boundary
 *   - Bash requires whitelist
 */
/** Tool handler function signature */
export type ToolHandler = (args: Record<string, unknown>, workspaceRoot: string) => Promise<ToolResult>;
/** Tool execution result */
export interface ToolResult {
    success: boolean;
    output: string;
    error?: string;
    filePath?: string;
}
/** Execute a tool by name */
export declare function executeTool(toolName: string, args: Record<string, unknown>, workspaceRoot: string, bashWhitelist?: string[]): Promise<ToolResult>;
//# sourceMappingURL=tool-registry.d.ts.map