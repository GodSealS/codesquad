/**
 * 代码分块器 — 分层 chunking for embedding
 *
 * 支持三种分块策略：
 * 1. tree-sitter (TypeScript/Python) — AST 感知，不切断函数体
 * 2. 正则 (Shell/Bash) — 函数名匹配
 * 3. key-split (YAML/JSON/Markdown) — 按顶级键分割
 *
 * Step 10 / 18 执行步骤
 */
export interface CodeChunk {
    id: string;
    filePath: string;
    startLine: number;
    endLine: number;
    content: string;
    summary: string;
    symbols: string[];
}
export interface ChunkOptions {
    /** 每个 chunk 的最大行数（默认 50） */
    maxLines?: number;
    /** 每个 chunk 的最大字符数（默认 2000） */
    maxChars?: number;
    /** 允许的最小 chunk 行数（默认 3） */
    minLines?: number;
}
/**
 * 扫描目录并分块所有支持的文件。
 */
export declare function scanAndChunk(rootDir: string, options?: ChunkOptions): CodeChunk[];
/**
 * 对单个文件分块。
 */
export declare function chunkFile(filePath: string, rootDir: string, options?: ChunkOptions): CodeChunk[];
/**
 * 增量检测：获取 git diff 变更的文件列表。
 * 需要 git 可用。
 */
export declare function getChangedFiles(rootDir: string): string[];
//# sourceMappingURL=code-chunker.d.ts.map