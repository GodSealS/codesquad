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
import { join, relative } from 'path';
import { readFileSync, readdirSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { getSharedDb } from './db.js';
import { DOC_EMBEDDINGS_DDL } from './schema.js';
import { getEmbeddingProvider } from './provider.js';
import { cosineSimilarity, serializeEmbedding, deserializeEmbedding } from './store.js';
export class DocAssociate {
    db;
    constructor(dbPathOverride) {
        this.db = getSharedDb(dbPathOverride);
        this.init();
    }
    init() {
        this.db.exec(DOC_EMBEDDINGS_DDL);
    }
    // ── 索引 ──
    /**
     * 索引目录下的所有 Markdown 文档。
     */
    async indexDocs(sourceDirs, rootDir) {
        const provider = await getEmbeddingProvider();
        if (!provider)
            return 0;
        const chunks = this.scanDocs(sourceDirs, rootDir);
        let indexed = 0;
        const insertStmt = this.db.prepare(/* sql */ `
      INSERT OR REPLACE INTO doc_embeddings
        (id, file_path, chunk_index, content, content_hash, embedding, updated_at)
      VALUES
        (@id, @filePath, @chunkIndex, @content, @contentHash, @embedding, datetime('now'))
    `);
        for (const chunk of chunks) {
            // 🔧 R2-6: SHA256 去重
            const existing = this.db.prepare('SELECT id FROM doc_embeddings WHERE content_hash = ?').get(chunk.contentHash);
            if (existing) {
                continue; // 已存在，跳过
            }
            const emb = await provider.embed(chunk.content);
            // 🔧 Bug Fix #4: 从 chunk.id 解析 chunkIndex（格式 doc:<hash>:<index>）
            const idxParts = chunk.id.split(':');
            const chunkIndex = idxParts.length >= 3 ? parseInt(idxParts[2], 10) || 0 : 0;
            insertStmt.run({
                id: chunk.id,
                filePath: chunk.filePath,
                chunkIndex,
                content: chunk.content,
                contentHash: chunk.contentHash,
                embedding: serializeEmbedding(emb),
            });
            indexed++;
        }
        return indexed;
    }
    // ── 搜索 ──
    /**
     * 搜索与查询相关的文档片段。
     */
    async searchDocs(query, topN = 5) {
        const provider = await getEmbeddingProvider();
        if (!provider)
            return [];
        const queryEmb = await provider.embed(query);
        const rows = this.db.prepare(/* sql */ `
      SELECT id, file_path, content, content_hash, embedding
      FROM doc_embeddings
    `).all();
        if (rows.length === 0)
            return [];
        const results = rows.map(row => ({
            chunk: {
                id: row.id,
                filePath: row.file_path,
                content: row.content,
                contentHash: row.content_hash,
            },
            similarity: cosineSimilarity(queryEmb, deserializeEmbedding(row.embedding)),
        }));
        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, topN).map(r => r.chunk);
    }
    /**
     * 格式化文档片段用于 system prompt 注入。
     */
    formatForPrompt(chunks) {
        if (chunks.length === 0)
            return '';
        const lines = [
            '**[DOC] 相关项目文档片段：**',
            '',
        ];
        for (const chunk of chunks) {
            lines.push(`📄 ${chunk.filePath}:`);
            lines.push('```');
            lines.push(chunk.content.slice(0, 500));
            lines.push('```');
            lines.push('');
        }
        return lines.join('\n');
    }
    // ── 内部 ──
    scanDocs(dirs, rootDir) {
        const chunks = [];
        for (const dir of dirs) {
            this.scanDir(dir, rootDir, chunks);
        }
        return chunks;
    }
    scanDir(dir, rootDir, chunks) {
        let entries;
        try {
            entries = readdirSync(dir);
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const fullPath = join(dir, entry);
            try {
                const stat = statSync(fullPath);
                if (stat.isDirectory() && !entry.startsWith('.')) {
                    this.scanDir(fullPath, rootDir, chunks);
                }
                else if (stat.isFile() && entry.endsWith('.md')) {
                    const content = readFileSync(fullPath, 'utf-8');
                    if (!content.trim())
                        continue;
                    const relativePath = relative(rootDir, fullPath);
                    const hash = createHash('sha256').update(content).digest('hex');
                    // 按段落分块（每段 ≤ 1000 字符）
                    const paragraphs = content.split(/\n\n+/);
                    let chunkIndex = 0;
                    let currentChunk = '';
                    for (const para of paragraphs) {
                        if ((currentChunk + para).length > 1000 && currentChunk) {
                            const chunkHash = createHash('sha256')
                                .update(currentChunk)
                                .digest('hex');
                            chunks.push({
                                id: `doc:${hash.slice(0, 12)}:${chunkIndex}`,
                                filePath: relativePath,
                                content: currentChunk.trim(),
                                contentHash: chunkHash,
                            });
                            chunkIndex++;
                            currentChunk = para;
                        }
                        else {
                            currentChunk += (currentChunk ? '\n\n' : '') + para;
                        }
                    }
                    // 最后一块
                    if (currentChunk.trim()) {
                        const chunkHash = createHash('sha256')
                            .update(currentChunk)
                            .digest('hex');
                        chunks.push({
                            id: `doc:${hash.slice(0, 12)}:${chunkIndex}`,
                            filePath: relativePath,
                            content: currentChunk.trim(),
                            contentHash: chunkHash,
                        });
                    }
                }
            }
            catch {
                // 跳过不可读文件
            }
        }
    }
    get count() {
        return this.db.prepare('SELECT COUNT(*) as cnt FROM doc_embeddings').get().cnt;
    }
    close() {
        // 共享连接不在此关闭
    }
}
// ── 全局单例 ──
let docAssociate = null;
export function getDocAssociate() {
    if (!docAssociate) {
        docAssociate = new DocAssociate();
    }
    return docAssociate;
}
export function resetDocAssociate() {
    docAssociate = null;
}
//# sourceMappingURL=doc-associate.js.map