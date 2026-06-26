/**
 * MCP Transport Types
 *
 * JSON-RPC 2.0 types for the MCP protocol.
 * Implements the spec without external dependencies.
 */
/** JSON-RPC 2.0 request */
export interface MCPRequest {
    jsonrpc: '2.0';
    id?: string | number;
    method: string;
    params?: Record<string, unknown>;
}
/** JSON-RPC 2.0 response (success) */
export interface MCPResponse {
    jsonrpc: '2.0';
    id: string | number | null;
    result?: unknown;
    error?: MCPError;
}
/** JSON-RPC 2.0 notification (no id) */
export interface MCPNotification {
    jsonrpc: '2.0';
    method: string;
    params?: Record<string, unknown>;
}
/** JSON-RPC 2.0 error */
export interface MCPError {
    code: number;
    message: string;
    data?: unknown;
}
/** MCP Initialize Result */
export interface MCPInitializeResult {
    protocolVersion: string;
    capabilities: {
        tools: Record<string, unknown>;
        prompts?: Record<string, unknown>;
        resources?: Record<string, unknown>;
    };
    serverInfo: {
        name: string;
        version: string;
    };
}
/** MCP Tool Definition */
export interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}
/** MCP Tools List Result */
export interface MCPListToolsResult {
    tools: MCPTool[];
}
/** MCP Tool Call Params */
export interface MCPCallToolParams {
    name: string;
    arguments?: Record<string, unknown>;
}
/** MCP Tool Call Result */
export interface MCPCallToolResult {
    content: MCPTextContent[];
    isError?: boolean;
}
/** MCP Text content block */
export interface MCPTextContent {
    type: 'text';
    text: string;
}
//# sourceMappingURL=types.d.ts.map