/**
 * TaskResult — 统一的返回值结构，用于所有 Agent、Skill、MCP、Tool 调用。
 *
 * Phase 0 (P3.1 前置) — 定义接口供 P0-P2 修复使用，P3 阶段全量接入。
 */
// ── Factory Helpers ──
/**
 * 创建成功结果。
 */
export function successResult(data, options) {
    return {
        taskId: options?.taskId ?? '',
        status: 'success',
        errorCode: null,
        message: options?.message ?? 'OK',
        data,
        warnings: options?.warnings ?? [],
        durationMs: options?.durationMs ?? 0,
        needsUserDecision: false,
    };
}
/**
 * 创建失败结果。
 */
export function errorResult(options) {
    return {
        taskId: options.taskId ?? '',
        status: 'failed',
        errorCode: options.errorCode,
        message: options.message,
        data: null,
        warnings: options.warnings ?? [],
        durationMs: options.durationMs ?? 0,
        needsUserDecision: false,
    };
}
/**
 * 创建需要用户决策的结果。
 */
export function userDecisionResult(options) {
    return {
        taskId: options.taskId ?? '',
        status: 'failed',
        errorCode: options.errorCode,
        message: options.message,
        data: null,
        warnings: options.warnings ?? [],
        durationMs: options.durationMs ?? 0,
        needsUserDecision: true,
        userDecisionContext: {
            question: options.question,
            options: options.options,
        },
    };
}
/**
 * 创建超时结果。
 */
export function timeoutResult(options) {
    return {
        taskId: options?.taskId ?? '',
        status: 'timed_out',
        errorCode: 'TIMEOUT',
        message: options?.message ?? 'Task timed out',
        data: null,
        warnings: options?.warnings ?? [],
        durationMs: options?.durationMs ?? 0,
        needsUserDecision: false,
    };
}
/**
 * 创建取消结果。
 */
export function cancelledResult(options) {
    return {
        taskId: options?.taskId ?? '',
        status: 'cancelled',
        errorCode: 'CANCELLED',
        message: options?.message ?? 'Task cancelled',
        data: null,
        warnings: options?.warnings ?? [],
        durationMs: options?.durationMs ?? 0,
        needsUserDecision: false,
    };
}
//# sourceMappingURL=task-result.js.map