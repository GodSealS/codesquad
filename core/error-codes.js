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
// ── Error Code Enum ──
export var ErrorCode;
(function (ErrorCode) {
    // ── 1xxx: Auto-recoverable ──
    ErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    ErrorCode["RATE_LIMIT"] = "RATE_LIMIT";
    ErrorCode["TIMEOUT"] = "TIMEOUT";
    ErrorCode["EMPTY_TOOL_CALLS"] = "EMPTY_TOOL_CALLS";
    ErrorCode["TOOL_PARSE_ERROR"] = "TOOL_PARSE_ERROR";
    ErrorCode["STREAM_INTERRUPTED"] = "STREAM_INTERRUPTED";
    // ── 2xxx: User decision required ──
    ErrorCode["AUTH_FAILED"] = "AUTH_FAILED";
    ErrorCode["BILLING_ISOLATED"] = "BILLING_ISOLATED";
    ErrorCode["MODEL_NOT_FOUND"] = "MODEL_NOT_FOUND";
    ErrorCode["PERMISSION_DENIED"] = "PERMISSION_DENIED";
    ErrorCode["QUOTA_EXCEEDED"] = "QUOTA_EXCEEDED";
    // ── 3xxx: Agent errors ──
    ErrorCode["AGENT_NOT_FOUND"] = "AGENT_NOT_FOUND";
    ErrorCode["AGENT_SPAWN_FAILED"] = "AGENT_SPAWN_FAILED";
    ErrorCode["AGENT_MAX_TURNS"] = "AGENT_MAX_TURNS";
    ErrorCode["AGENT_TRUNCATED"] = "AGENT_TRUNCATED";
    ErrorCode["AGENT_CANCELLED"] = "AGENT_CANCELLED";
    ErrorCode["COORDINATOR_DECOMPOSE_FAILED"] = "COORDINATOR_DECOMPOSE_FAILED";
    // ── 4xxx: System errors ──
    ErrorCode["CRASH"] = "CRASH";
    ErrorCode["OUT_OF_MEMORY"] = "OUT_OF_MEMORY";
    ErrorCode["DISK_FULL"] = "DISK_FULL";
    ErrorCode["COMPACT_TIMEOUT"] = "COMPACT_TIMEOUT";
    ErrorCode["COMPACT_FAILED"] = "COMPACT_FAILED";
    ErrorCode["SESSION_SAVE_FAILED"] = "SESSION_SAVE_FAILED";
    ErrorCode["SESSION_LOAD_FAILED"] = "SESSION_LOAD_FAILED";
    ErrorCode["MCP_CONNECTION_FAILED"] = "MCP_CONNECTION_FAILED";
    ErrorCode["LLM_BRIDGE_NOT_READY"] = "LLM_BRIDGE_NOT_READY";
    // ── 5xxx: Tool errors ──
    ErrorCode["TOOL_EXECUTION_FAILED"] = "TOOL_EXECUTION_FAILED";
    ErrorCode["TOOL_INVALID_INPUT"] = "TOOL_INVALID_INPUT";
    ErrorCode["TOOL_PERMISSION_DENIED"] = "TOOL_PERMISSION_DENIED";
    ErrorCode["FILE_READ_FAILED"] = "FILE_READ_FAILED";
    ErrorCode["FILE_WRITE_FAILED"] = "FILE_WRITE_FAILED";
    // ── Generic ──
    ErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
})(ErrorCode || (ErrorCode = {}));
// ── Error Code Categories ──
/** AI 可自行处理的异常（触发自动重试/回退） */
export const AUTO_RECOVERABLE_CODES = new Set([
    ErrorCode.NETWORK_ERROR,
    ErrorCode.RATE_LIMIT,
    ErrorCode.TIMEOUT,
    ErrorCode.EMPTY_TOOL_CALLS,
    ErrorCode.TOOL_PARSE_ERROR,
    ErrorCode.STREAM_INTERRUPTED,
]);
/** 需通知用户决策的异常 */
export const USER_DECISION_CODES = new Set([
    ErrorCode.AUTH_FAILED,
    ErrorCode.BILLING_ISOLATED,
    ErrorCode.MODEL_NOT_FOUND,
    ErrorCode.PERMISSION_DENIED,
    ErrorCode.QUOTA_EXCEEDED,
]);
/** 严重异常（立即终止） */
export const FATAL_ERROR_CODES = new Set([
    ErrorCode.CRASH,
    ErrorCode.OUT_OF_MEMORY,
    ErrorCode.DISK_FULL,
]);
const ERROR_MESSAGES = {
    [ErrorCode.NETWORK_ERROR]: { zh: '网络连接失败，正在重试...', en: 'Network error, retrying...' },
    [ErrorCode.RATE_LIMIT]: { zh: '请求频率超限，稍后重试', en: 'Rate limit exceeded, retrying...' },
    [ErrorCode.TIMEOUT]: { zh: '请求超时，正在重试...', en: 'Request timeout, retrying...' },
    [ErrorCode.EMPTY_TOOL_CALLS]: { zh: '模型返回空工具调用，请重新尝试', en: 'Model returned empty tool calls, please try again' },
    [ErrorCode.TOOL_PARSE_ERROR]: { zh: '工具调用解析失败', en: 'Failed to parse tool call' },
    [ErrorCode.STREAM_INTERRUPTED]: { zh: '流式响应中断，正在重连...', en: 'Stream interrupted, reconnecting...' },
    [ErrorCode.AUTH_FAILED]: { zh: 'API 鉴权失败，请检查密钥', en: 'Authentication failed, please check your API key' },
    [ErrorCode.BILLING_ISOLATED]: { zh: '账户欠费隔离，请充值', en: 'Account isolated due to billing, please recharge' },
    [ErrorCode.MODEL_NOT_FOUND]: { zh: '模型不存在或不可用', en: 'Model not found or unavailable' },
    [ErrorCode.PERMISSION_DENIED]: { zh: '权限不足', en: 'Permission denied' },
    [ErrorCode.QUOTA_EXCEEDED]: { zh: '配额已用尽，请联系管理员', en: 'Quota exceeded, please contact administrator' },
    [ErrorCode.AGENT_NOT_FOUND]: { zh: 'Agent 不存在', en: 'Agent not found' },
    [ErrorCode.AGENT_SPAWN_FAILED]: { zh: 'Agent 启动失败', en: 'Agent spawn failed' },
    [ErrorCode.AGENT_MAX_TURNS]: { zh: 'Agent 达到最大轮数', en: 'Agent reached maximum turns' },
    [ErrorCode.AGENT_TRUNCATED]: { zh: 'Agent 对话被截断', en: 'Agent conversation truncated' },
    [ErrorCode.AGENT_CANCELLED]: { zh: 'Agent 已取消', en: 'Agent cancelled' },
    [ErrorCode.COORDINATOR_DECOMPOSE_FAILED]: { zh: '任务分解失败', en: 'Task decomposition failed' },
    [ErrorCode.CRASH]: { zh: '系统崩溃，请重启', en: 'System crash, please restart' },
    [ErrorCode.OUT_OF_MEMORY]: { zh: '内存不足，请释放资源', en: 'Out of memory, please free resources' },
    [ErrorCode.DISK_FULL]: { zh: '磁盘空间不足', en: 'Disk full' },
    [ErrorCode.COMPACT_TIMEOUT]: { zh: '对话压缩超时，建议开启新对话', en: 'Conversation compaction timed out, suggest starting a new conversation' },
    [ErrorCode.COMPACT_FAILED]: { zh: '对话压缩失败，建议开启新对话', en: 'Conversation compaction failed, suggest starting a new conversation' },
    [ErrorCode.SESSION_SAVE_FAILED]: { zh: '会话保存失败', en: 'Session save failed' },
    [ErrorCode.SESSION_LOAD_FAILED]: { zh: '会话加载失败', en: 'Session load failed' },
    [ErrorCode.MCP_CONNECTION_FAILED]: { zh: 'MCP 连接失败', en: 'MCP connection failed' },
    [ErrorCode.LLM_BRIDGE_NOT_READY]: { zh: 'LLM 桥接未就绪', en: 'LLM bridge not ready' },
    [ErrorCode.TOOL_EXECUTION_FAILED]: { zh: '工具执行失败', en: 'Tool execution failed' },
    [ErrorCode.TOOL_INVALID_INPUT]: { zh: '工具输入参数无效', en: 'Invalid tool input' },
    [ErrorCode.TOOL_PERMISSION_DENIED]: { zh: '工具权限不足', en: 'Tool permission denied' },
    [ErrorCode.FILE_READ_FAILED]: { zh: '文件读取失败', en: 'File read failed' },
    [ErrorCode.FILE_WRITE_FAILED]: { zh: '文件写入失败', en: 'File write failed' },
    [ErrorCode.UNKNOWN_ERROR]: { zh: '未知错误', en: 'Unknown error' },
    [ErrorCode.INTERNAL_ERROR]: { zh: '内部错误', en: 'Internal error' },
};
// ── Public API ──
/**
 * 根据错误码获取本地化消息。
 * @param errorCode 错误码（字符串，兼容自定义码）
 * @param lang 语言（默认 'zh'）
 * @param fallback 未匹配时的回退消息
 */
export function getErrorMessage(errorCode, lang = 'zh', fallback) {
    const entry = ERROR_MESSAGES[errorCode];
    if (entry)
        return entry[lang];
    return fallback ?? `${errorCode}: ${lang === 'zh' ? '未知错误' : 'Unknown error'}`;
}
/**
 * 批量获取所有错误码的中文消息（用于文档生成）。
 */
export function getAllErrorMessages() {
    return Object.entries(ERROR_MESSAGES).map(([code, msg]) => ({
        code,
        zh: msg.zh,
        en: msg.en,
    }));
}
//# sourceMappingURL=error-codes.js.map