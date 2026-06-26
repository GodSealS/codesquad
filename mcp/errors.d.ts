/**
 * MCP Error Model
 *
 * JSON-RPC style error codes for agent/skill execution.
 * Reusable across MCP Server, LLM client, and tool handlers.
 */
/** Structured error returned to MCP callers */
export interface McpError {
    code: number;
    message: string;
    data?: {
        errorCode: McpErrorCode;
        retryable: boolean;
        retryAfterMs?: number;
        details?: Record<string, unknown>;
    };
}
/** Error code enum matching the design doc §5.1 */
export declare const McpErrorCode: {
    readonly AGENT_NOT_FOUND: "AGENT_NOT_FOUND";
    readonly SKILL_NOT_FOUND: "SKILL_NOT_FOUND";
    readonly INVALID_INPUT: "INVALID_INPUT";
    readonly WORKSPACE_VIOLATION: "WORKSPACE_VIOLATION";
    readonly TOOL_FORBIDDEN: "TOOL_FORBIDDEN";
    readonly TOOL_NOT_FOUND: "TOOL_NOT_FOUND";
    readonly MAX_TURNS_EXCEEDED: "MAX_TURNS_EXCEEDED";
    readonly CONTEXT_TOO_LARGE: "CONTEXT_TOO_LARGE";
    readonly LLM_RATE_LIMITED: "LLM_RATE_LIMITED";
    readonly LLM_AUTH_FAILED: "LLM_AUTH_FAILED";
    readonly LLM_TIMEOUT: "LLM_TIMEOUT";
    readonly BUDGET_EXCEEDED: "BUDGET_EXCEEDED";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
    readonly STUB_PARSE_ERROR: "STUB_PARSE_ERROR";
    readonly STUB_NOT_FOUND: "STUB_NOT_FOUND";
};
export type McpErrorCode = (typeof McpErrorCode)[keyof typeof McpErrorCode];
/** JSON-RPC error code mapping */
export declare const ERROR_CODE_MAP: Record<McpErrorCode, number>;
/** Retryable categories per §5.2 */
export declare const RETRYABLE_ERRORS: McpErrorCode[];
export declare const FALLBACK_ERRORS: McpErrorCode[];
/** Build a structured McpError */
export declare function mcpError(errorCode: McpErrorCode, message: string, details?: Record<string, unknown>, retryAfterMs?: number): McpError;
//# sourceMappingURL=errors.d.ts.map