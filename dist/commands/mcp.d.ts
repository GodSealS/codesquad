/**
 * MCP Command
 *
 * codesquad mcp [stdio|serve|status|convert-stubs|logs|metrics]
 *
 * Starts the CodeSquad MCP Server in various modes.
 */
/** Start MCP server in stdio mode (for IDE integration) */
export declare function handleMcpStdio(projectRoot?: string): void;
/** Start MCP server in HTTP mode */
export declare function handleMcpServe(projectRoot?: string, options?: {
    port?: number;
    authToken?: string;
    bind?: string;
}): Promise<void>;
/** Convert AICore files to MCP stubs */
export declare function handleConvertStubs(outputDir?: string): void;
/** Show MCP server status with trace/log info */
export declare function handleMcpStatus(projectRoot?: string): void;
/** Export trace data as JSON */
export declare function handleMcpLogs(): void;
/** Export metrics (simple summary from in-process counters) */
export declare function handleMcpMetrics(): void;
/** Bridge subcommand has been removed — REPL and Web Console are the primary interfaces. */
/** Inject MCP server configuration into AICore/settings.json */
export declare function injectMcpServerConfig(root: string): void;
//# sourceMappingURL=mcp.d.ts.map