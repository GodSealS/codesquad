/**
 * Code RAG — 全量索引 + 增量索引 + 语义搜索
 *
 * Step 10 / 18 执行步骤
 */
import { join } from 'path';
import { existsSync } from 'fs';
import { getSharedDb } from './db.js';
import { CODE_EMBEDDINGS_DDL } from './schema.js';
import { scanAndChunk, chunkFile, getChangedFiles } from './code-chunker.js';
import { getEmbeddingProvider } from './provider.js';
import { cosineSimilarity, serializeEmbedding, deserializeEmbedding } from './store.js';
// ── CodeRAG 类 ──
export class CodeRAG {
    db;
    constructor(dbPathOverride) {
        this.db = getSharedDb(dbPathOverride);
        this.init();
    }
    init() {
        this.db.exec(CODE_EMBEDDINGS_DDL);
    }
    // ── 索引 ──
    /**
     * 全量索引：扫描整个项目并索引所有支持的代码文件。
     */
    async indexAll(rootDir) {
        const provider = await getEmbeddingProvider();
        if (!provider) {
            throw new Error('[CodeRAG] no embedding provider available');
        }
        const chunks = scanAndChunk(rootDir);
        let indexed = 0;
        const insertStmt = this.db.prepare(/* sql */ `
      INSERT OR REPLACE INTO code_embeddings
        (id, file_path, start_line, end_line, content, summary, symbols, embedding, updated_at)
      VALUES
        (@id, @filePath, @startLine, @endLine, @content, @summary, @symbols, @embedding, datetime('now'))
    `);
        // 批量 embed + 写入
        const BATCH_SIZE = 20;
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            const texts = batch.map(c => c.content);
            const embeddings = await provider.embedBatch(texts);
            const insertBatch = this.db.transaction(() => {
                for (let j = 0; j < batch.length; j++) {
                    const chunk = batch[j];
                    const emb = embeddings[j];
                    insertStmt.run({
                        id: chunk.id,
                        filePath: chunk.filePath,
                        startLine: chunk.startLine,
                        endLine: chunk.endLine,
                        content: chunk.content,
                        summary: chunk.summary,
                        symbols: JSON.stringify(chunk.symbols),
                        embedding: serializeEmbedding(emb),
                    });
                    indexed++;
                }
            });
            insertBatch();
        }
        return { total: indexed, skipped: chunks.length - indexed };
    }
    /**
     * 增量索引：仅索引 git diff 变更的文件。
     */
    async indexIncremental(rootDir) {
        const changed = getChangedFiles(rootDir);
        if (changed.length === 0)
            return { total: 0, skipped: 0 };
        const provider = await getEmbeddingProvider();
        if (!provider) {
            throw new Error('[CodeRAG] no embedding provider available');
        }
        // 删除已变更文件的旧索引
        const deleteStmt = this.db.prepare('DELETE FROM code_embeddings WHERE file_path = ?');
        for (const file of changed) {
            deleteStmt.run(file);
        }
        // 重新索引变更文件
        let indexed = 0;
        const insertStmt = this.db.prepare(/* sql */ `
      INSERT OR REPLACE INTO code_embeddings
        (id, file_path, start_line, end_line, content, summary, symbols, embedding, updated_at)
      VALUES
        (@id, @filePath, @startLine, @endLine, @content, @summary, @symbols, @embedding, datetime('now'))
    `);
        for (const file of changed) {
            const fullPath = join(rootDir, file);
            if (!existsSync(fullPath))
                continue;
            try {
                const chunks = chunkFile(fullPath, rootDir);
                for (const chunk of chunks) {
                    const emb = await provider.embed(chunk.content);
                    insertStmt.run({
                        id: chunk.id,
                        filePath: chunk.filePath,
                        startLine: chunk.startLine,
                        endLine: chunk.endLine,
                        content: chunk.content,
                        summary: chunk.summary,
                        symbols: JSON.stringify(chunk.symbols),
                        embedding: serializeEmbedding(emb),
                    });
                    indexed++;
                }
            }
            catch {
                // 跳过不可索引文件
            }
        }
        return { total: indexed, skipped: changed.length - indexed };
    }
    // ── 搜索 ──
    /**
     * 语义搜索代码库。
     *
     * @param query 自然语言查询
     * @param topN 返回 Top-N 结果
     */
    async search(query, topN = 10) {
        const provider = await getEmbeddingProvider();
        if (!provider) {
            return [];
        }
        const queryEmb = await provider.embed(query);
        // 全量加载
        const rows = this.db.prepare(/* sql */ `
      SELECT id, file_path, start_line, end_line, content, summary, symbols, embedding
      FROM code_embeddings
    `).all();
        if (rows.length === 0)
            return [];
        // 计算相似度
        const results = [];
        for (const row of rows) {
            const emb = deserializeEmbedding(row.embedding);
            const similarity = cosineSimilarity(queryEmb, emb);
            results.push({
                id: row.id,
                filePath: row.file_path,
                startLine: row.start_line,
                endLine: row.end_line,
                content: row.content,
                summary: row.summary,
                symbols: row.symbols,
                similarity,
            });
        }
        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, topN);
    }
    // ── 查询 ──
    /** 索引条目总数 */
    get count() {
        const row = this.db.prepare('SELECT COUNT(*) as cnt FROM code_embeddings').get();
        return row.cnt;
    }
    /** 已索引的文件列表 */
    listIndexedFiles() {
        const rows = this.db
            .prepare('SELECT DISTINCT file_path FROM code_embeddings')
            .all();
        return rows.map(r => r.file_path);
    }
    close() {
        // 共享连接不在此关闭
    }
}
// ── 全局单例 ──
let ragInstance = null;
export function getCodeRAG() {
    if (!ragInstance) {
        ragInstance = new CodeRAG();
    }
    return ragInstance;
}
export function resetCodeRAG() {
    ragInstance = null;
}
//# sourceMappingURL=code-rag.js.map