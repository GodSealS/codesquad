/**
 * ErrorCodes — 统一的错误码枚举 + 中英文映射表。
 *
 * Phase 0 (P3.1 前置) — P0-P2 修复复用，P2.3 错误码映射使用。
 *
 * 分类：
 *   - 1xxx: AutoRecoverable（LLM 自动重试）
 *   - 2xxx: UserDecision（需通知用户决策）
 *   - 3xxx: AgentError（Agent 执行异常）
 *   - 4xxx: SystemError（严重系统异常）
 *   - 5xxx: ToolError（工具执行异常）
 */
export declare enum ErrorCode {
    NETWORK_ERROR = "NETWORK_ERROR",
    RATE_LIMIT = "RATE_LIMIT",
    TIMEOUT = "TIMEOUT",
    EMPTY_TOOL_CALLS = "EMPTY_TOOL_CALLS",
    TOOL_PARSE_ERROR = "TOOL_PARSE_ERROR",
    STREAM_INTERRUPTED = "STREAM_INTERRUPTED",
    AUTH_FAILED = "AUTH_FAILED",
    BILLING_ISOLATED = "BILLING_ISOLATED",
    MODEL_NOT_FOUND = "MODEL_NOT_FOUND",
    PERMISSION_DENIED = "PERMISSION_DENIED",
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
    AGENT_NOT_FOUND = "AGENT_NOT_FOUND",
    AGENT_SPAWN_FAILED = "AGENT_SPAWN_FAILED",
    AGENT_MAX_TURNS = "AGENT_MAX_TURNS",
    AGENT_TRUNCATED = "AGENT_TRUNCATED",
    AGENT_CANCELLED = "AGENT_CANCELLED",
    COORDINATOR_DECOMPOSE_FAILED = "COORDINATOR_DECOMPOSE_FAILED",
    CRASH = "CRASH",
    OUT_OF_MEMORY = "OUT_OF_MEMORY",
    DISK_FULL = "DISK_FULL",
    COMPACT_TIMEOUT = "COMPACT_TIMEOUT",
    COMPACT_FAILED = "COMPACT_FAILED",
    SESSION_SAVE_FAILED = "SESSION_SAVE_FAILED",
    SESSION_LOAD_FAILED = "SESSION_LOAD_FAILED",
    MCP_CONNECTION_FAILED = "MCP_CONNECTION_FAILED",
    LLM_BRIDGE_NOT_READY = "LLM_BRIDGE_NOT_READY",
    TOOL_EXECUTION_FAILED = "TOOL_EXECUTION_FAILED",
    TOOL_INVALID_INPUT = "TOOL_INVALID_INPUT",
    TOOL_PERMISSION_DENIED = "TOOL_PERMISSION_DENIED",
    FILE_READ_FAILED = "FILE_READ_FAILED",
    FILE_WRITE_FAILED = "FILE_WRITE_FAILED",
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
    INTERNAL_ERROR = "INTERNAL_ERROR"
}
/** AI 可自行处理的异常（触发自动重试/回退） */
export declare const AUTO_RECOVERABLE_CODES: Set<string>;
/** 需通知用户决策的异常 */
export declare const USER_DECISION_CODES: Set<string>;
/** 严重异常（立即终止） */
export declare const FATAL_ERROR_CODES: Set<string>;
export interface ErrorMessage {
    zh: string;
    en: string;
}
/**
 * 根据错误码获取本地化消息。
 * @param errorCode 错误码（字符串，兼容自定义码）
 * @param lang 语言（默认 'zh'）
 * @param fallback 未匹配时的回退消息
 */
export declare function getErrorMessage(errorCode: string, lang?: 'zh' | 'en', fallback?: string): string;
/**
 * 批量获取所有错误码的中文消息（用于文档生成）。
 */
export declare function getAllErrorMessages(): Array<{
    code: string;
    zh: string;
    en: string;
}>;
//# sourceMappingURL=error-codes.d.ts.map