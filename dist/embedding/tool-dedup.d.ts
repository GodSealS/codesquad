/**
 * 工具调用智能去重 — 语义相同但字面不同的调用复用缓存
 *
 * TTL 策略：
 * - Read: ∞ (基于 mtime) — 文件未修改则缓存永不过期
 * - Glob: 30s — 目录 mtime 检查
 * - Grep: 10s — AI 可能在修改代码
 * - Bash: 0 — 命令执行永不去重
 * - Write/Edit: 0 — 写操作永不去重
 *
 * Step 13 / 18 执行步骤
 */
export declare class ToolDedup {
    private db;
    constructor(dbPathOverride?: string);
    private init;
    /**
     * 检查是否有可复用的缓存结果。
     *
     * @param toolName 工具名称
     * @param toolInput 工具输入的 JSON 字符串
     * @returns 缓存的结果或 null
     */
    check(toolName: string, toolInput: string): Promise<unknown | null>;
    /**
     * 记录工具调用结果到缓存。
     */
    cache(toolName: string, toolInput: string, result: unknown): Promise<void>;
    private cleanup;
    clear(): void;
    close(): void;
}
export declare function getToolDedup(): ToolDedup;
export declare function resetToolDedup(): void;
//# sourceMappingURL=tool-dedup.d.ts.map