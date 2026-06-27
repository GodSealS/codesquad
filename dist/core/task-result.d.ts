/**
 * TaskResult — 统一的返回值结构，用于所有 Agent、Skill、MCP、Tool 调用。
 *
 * Phase 0 (P3.1 前置) — 定义接口供 P0-P2 修复使用，P3 阶段全量接入。
 */
export type TaskStatus = 'success' | 'partial_success' | 'failed' | 'cancelled' | 'timed_out';
export interface TaskResult<T = unknown> {
    /** 任务唯一标识（对应 AgentInstanceManager.instance.id） */
    taskId: string;
    /** 任务状态 */
    status: TaskStatus;
    /** 错误码（成功时为 null） */
    errorCode: string | null;
    /** 人类可读消息（中文优先，英文 fallback） */
    message: string;
    /** 任务结果数据 */
    data: T | null;
    /** 警告列表（非致命问题） */
    warnings: string[];
    /** 执行耗时 (ms) — 由 runner 层记录 startTime/endTime 差值 */
    durationMs: number;
    /** 是否需要用户决策 */
    needsUserDecision: boolean;
    /** 用户决策上下文（当 needsUserDecision=true 时） */
    userDecisionContext?: {
        question: string;
        options: string[];
    };
}
/**
 * 创建成功结果。
 */
export declare function successResult<T>(data: T, options?: {
    taskId?: string;
    message?: string;
    warnings?: string[];
    durationMs?: number;
}): TaskResult<T>;
/**
 * 创建失败结果。
 */
export declare function errorResult(options: {
    taskId?: string;
    errorCode: string;
    message: string;
    warnings?: string[];
    durationMs?: number;
}): TaskResult<null>;
/**
 * 创建需要用户决策的结果。
 */
export declare function userDecisionResult(options: {
    taskId?: string;
    errorCode: string;
    message: string;
    question: string;
    options: string[];
    warnings?: string[];
    durationMs?: number;
}): TaskResult<null>;
/**
 * 创建超时结果。
 */
export declare function timeoutResult(options?: {
    taskId?: string;
    message?: string;
    warnings?: string[];
    durationMs?: number;
}): TaskResult<null>;
/**
 * 创建取消结果。
 */
export declare function cancelledResult(options?: {
    taskId?: string;
    message?: string;
    warnings?: string[];
    durationMs?: number;
}): TaskResult<null>;
//# sourceMappingURL=task-result.d.ts.map