/**
 * 文档自动关联 — 索引 + 检索 + SHA256 去重
 *
 * 对 ProjectDoc/ + docs/ 文档做 chunk embedding，
 * 提问时自动注入相关设计片段。
 *
 * 🔧 R2-6: SHA256 去重（同一内容出现在两个文件中只索引一次）
 *
 * Step 12 / 18 执行步骤
 */
import type { DocChunk } from './types.js';
export declare class DocAssociate {
    private db;
    constructor(dbPathOverride?: string);
    private init;
    /**
     * 索引目录下的所有 Markdown 文档。
     */
    indexDocs(sourceDirs: string[], rootDir: string): Promise<number>;
    /**
     * 搜索与查询相关的文档片段。
     */
    searchDocs(query: string, topN?: number): Promise<DocChunk[]>;
    /**
     * 格式化文档片段用于 system prompt 注入。
     */
    formatForPrompt(chunks: DocChunk[]): string;
    private scanDocs;
    private scanDir;
    get count(): number;
    close(): void;
}
export declare function getDocAssociate(): DocAssociate;
export declare function resetDocAssociate(): void;
//# sourceMappingURL=doc-associate.d.ts.map