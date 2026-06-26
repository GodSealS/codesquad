/**
 * ToolSearchTool — Let agents discover available tools at runtime.
 *
 * When the agent needs to find a tool it doesn't know about, it can search
 * by keyword. Returns tool names + descriptions, not full schemas (saves tokens).
 *
 * Phase 6.2 — Chat Feature Gap Fill
 */
export declare const ToolSearchTool: import("./types.js").Tool<{
    query: string;
    maxResults?: number | undefined;
}, unknown>;
//# sourceMappingURL=ToolSearchTool.d.ts.map