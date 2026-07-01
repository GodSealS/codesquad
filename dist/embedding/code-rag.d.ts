/**
 * Code RAG — 全量索引 + 增量索引 + 语义搜索
 *
 * Step 10 / 18 执行步骤
 */
import type { CodeSearchResult } from './types.js';
export declare class CodeRAG {
    private db;
    constructor(dbPathOverride?: string);
    private init;
    /**
     * 全量索引：扫描整个项目并索引所有支持的代码文件。
     */
    indexAll(rootDir: string): Promise<{
        total: number;
        skipped: number;
    }>;
    /**
     * 增量索引：仅索引 git diff 变更的文件。
     */
    indexIncremental(rootDir: string): Promise<{
        total: number;
        skipped: number;
    }>;
    /**
     * 语义搜索代码库。
     *
     * @param query 自然语言查询
     * @param topN 返回 Top-N 结果
     */
    search(query: string, topN?: number): Promise<CodeSearchResult[]>;
    /** 索引条目总数 */
    get count(): number;
    /** 已索引的文件列表 */
    listIndexedFiles(): string[];
    close(): void;
}
export declare function getCodeRAG(): CodeRAG;
export declare function resetCodeRAG(): void;
//# sourceMappingURL=code-rag.d.ts.map