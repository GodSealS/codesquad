/**
 * Few-Shot 示例检索 — 从历史成功对话中检索最相似示例
 *
 * 收集触发：
 * - 👍 → quality=4
 * - ❤️ → quality=5
 * - 未反馈但产出被接受 → quality=3（隐式）
 *
 * 案例库最多保留 1000 条，LRU 淘汰。
 *
 * Step 11 / 18 执行步骤
 */
import type { FewShotExample } from './types.js';
export declare class ExampleStore {
    private db;
    constructor(dbPathOverride?: string);
    private init;
    /**
     * 收集示例（用户 👍/❤️ 之后调用）。
     */
    collect(userInput: string, assistantOutput: string, sessionId: string, quality?: 3 | 4 | 5): Promise<void>;
    /**
     * 检索与 userInput 最相似的 Top-N 示例。
     */
    retrieve(userInput: string, topN?: number): Promise<FewShotExample[]>;
    /**
     * 格式化示例用于 system prompt 注入。
     */
    formatForPrompt(examples: FewShotExample[]): string;
    private evict;
    get count(): number;
    close(): void;
}
export declare function getExampleStore(): ExampleStore;
export declare function resetExampleStore(): void;
//# sourceMappingURL=examples.d.ts.map