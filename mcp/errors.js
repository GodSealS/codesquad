/**
 * MCP Error Model
 *
 * JSON-RPC style error codes for agent/skill execution.
 * Reusable across MCP Server, LLM client, and tool handlers.
 */
/** Error code enum matching the design doc §5.1 */
export const McpErrorCode = {
    AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
    SKILL_NOT_FOUND: 'SKILL_NOT_FOUND',
    INVALID_INPUT: 'INVALID_INPUT',
    WORKSPACE_VIOLATION: 'WORKSPACE_VIOLATION',
    TOOL_FORBIDDEN: 'TOOL_FORBIDDEN',
    TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
    MAX_TURNS_EXCEEDED: 'MAX_TURNS_EXCEEDED',
    CONTEXT_TOO_LARGE: 'CONTEXT_TOO_LARGE',
    LLM_RATE_LIMITED: 'LLM_RATE_LIMITED',
    LLM_AUTH_FAILED: 'LLM_AUTH_FAILED',
    LLM_TIMEOUT: 'LLM_TIMEOUT',
    BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    STUB_PARSE_ERROR: 'STUB_PARSE_ERROR',
    STUB_NOT_FOUND: 'STUB_NOT_FOUND',
};
/** JSON-RPC error code mapping */
export const ERROR_CODE_MAP = {
    AGENT_NOT_FOUND: -32001,
    SKILL_NOT_FOUND: -32002,
    INVALID_INPUT: -32602,
    WORKSPACE_VIOLATION: -32003,
    TOOL_FORBIDDEN: -32004,
    TOOL_NOT_FOUND: -32005,
    MAX_TURNS_EXCEEDED: -32006,
    CONTEXT_TOO_LARGE: -32007,
    LLM_RATE_LIMITED: -32008,
    LLM_AUTH_FAILED: -32009,
    LLM_TIMEOUT: -32010,
    BUDGET_EXCEEDED: -32011,
    INTERNAL_ERROR: -32603,
    STUB_PARSE_ERROR: -32012,
    STUB_NOT_FOUND: -32013,
};
/** Retryable categories per §5.2 */
export const RETRYABLE_ERRORS = [
    McpErrorCode.LLM_RATE_LIMITED,
    McpErrorCode.LLM_TIMEOUT,
    McpErrorCode.LLM_AUTH_FAILED,
];
export const FALLBACK_ERRORS = [
    McpErrorCode.LLM_AUTH_FAILED,
    McpErrorCode.LLM_TIMEOUT,
];
/** Build a structured McpError */
export function mcpError(errorCode, message, details, retryAfterMs) {
    const retryable = RETRYABLE_ERRORS.includes(errorCode);
    return {
        code: ERROR_CODE_MAP[errorCode],
        message,
        data: {
            errorCode,
            retryable,
            ...(retryAfterMs ? { retryAfterMs } : {}),
            ...(details ? { details } : {}),
        },
    };
}
//# sourceMappingURL=errors.js.map