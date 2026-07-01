/**
 * VectorStore — SQLite 向量存储 + 余弦相似度搜索
 *
 * 管理消息 embedding 的 CRUD，提供跨 session 的语义搜索。
 * 初期策略：全量加载到内存计算余弦相似度（<10000 条时 <5ms）。
 * 后期可升级为 sqlite-vec KNN 索引。
 *
 * Step 2 / 18 执行步骤
 */
import { getSharedDb } from './db.js';
import { MESSAGE_EMBEDDINGS_DDL } from './schema.js';
/**
 * 将 Float32Array 序列化为 Buffer（用于 SQLite BLOB 存储）。
 */
export function serializeEmbedding(emb) {
    return Buffer.from(emb.buffer, emb.byteOffset, emb.byteLength);
}
/**
 * 将 SQLite BLOB 反序列化为 Float32Array。
 */
export function deserializeEmbedding(buf) {
    return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}
/**
 * 计算两个向量的余弦相似度。
 */
export function cosineSimilarity(a, b) {
    if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0)
        return 0;
    return dotProduct / denominator;
}
// ── VectorStore 类 ──
export class VectorStore {
    db;
    initialized = false;
    constructor(dbPathOverride) {
        this.db = getSharedDb(dbPathOverride);
        this.init();
    }
    /** 初始化表结构（幂等）。 */
    init() {
        if (this.initialized)
            return;
        this.db.exec(MESSAGE_EMBEDDINGS_DDL);
        this.initialized = true;
    }
    // ── CRUD ──
    /**
     * 插入或更新单条 embedding 记录。
     */
    upsert(record) {
        this.init();
        const contentBlob = serializeEmbedding(record.contentEmbedding);
        const summaryBlob = record.summaryEmbedding
            ? serializeEmbedding(record.summaryEmbedding)
            : null;
        // 🔧 Bug Fix #9: 保留已有记录的 created_at
        const existing = this.db
            .prepare('SELECT created_at FROM message_embeddings WHERE id = ?')
            .get(record.id);
        const createdAt = existing?.created_at ?? new Date().toISOString();
        const updatedAt = new Date().toISOString();
        const stmt = this.db.prepare(/* sql */ `
      INSERT OR REPLACE INTO message_embeddings
        (id, session_id, message_index, role, content, summary,
         content_embedding, summary_embedding, created_at, updated_at)
      VALUES
        (@id, @sessionId, @msgIndex, @role, @content, @summary,
         @contentEmb, @summaryEmb, @createdAt, @updatedAt)
    `);
        stmt.run({
            id: record.id,
            sessionId: record.sessionId,
            msgIndex: record.messageIndex,
            role: record.role,
            content: record.content,
            summary: record.summary,
            contentEmb: contentBlob,
            summaryEmb: summaryBlob,
            createdAt,
            updatedAt,
        });
    }
    /**
     * 批量 upsert（事务包装）。
     */
    batchUpsert(records) {
        this.init();
        const upsertOne = this.db.transaction((recs) => {
            for (const r of recs) {
                this.upsert(r);
            }
        });
        upsertOne(records);
    }
    /**
     * 按 sessionId 删除所有相关 embedding。
     */
    deleteBySession(sessionId) {
        this.init();
        this.db
            .prepare('DELETE FROM message_embeddings WHERE session_id = ?')
            .run(sessionId);
    }
    // ── 搜索 ──
    /**
     * 余弦相似度搜索（全量加载到内存）。
     *
     * @param queryEmbedding 查询向量
     * @param threshold 相似度阈值 [0,1]
     * @param limit 返回的最大结果数
     * @param excludeSessionId 排除的 session（通常为当前 session）
     */
    searchSimilar(queryEmbedding, threshold, limit, excludeSessionId) {
        this.init();
        // 全量加载到内存
        let rows;
        if (excludeSessionId) {
            rows = this.db
                .prepare('SELECT id, session_id, role, content, summary, content_embedding FROM message_embeddings WHERE session_id != ?')
                .all(excludeSessionId);
        }
        else {
            rows = this.db
                .prepare('SELECT id, session_id, role, content, summary, content_embedding FROM message_embeddings')
                .all();
        }
        // 计算相似度并排序
        const results = [];
        for (const row of rows) {
            const emb = deserializeEmbedding(row.content_embedding);
            const similarity = cosineSimilarity(queryEmbedding, emb);
            if (similarity >= threshold) {
                results.push({
                    id: row.id,
                    sessionId: row.session_id,
                    role: row.role,
                    content: row.content,
                    summary: row.summary,
                    similarity,
                });
            }
        }
        // 按相似度降序排序，取 top-N
        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, limit);
    }
    /**
     * 在指定 session 内搜索相似消息。
     */
    searchBySession(sessionId, queryEmbedding, threshold) {
        this.init();
        const rows = this.db
            .prepare('SELECT id, session_id, role, content, summary, content_embedding FROM message_embeddings WHERE session_id = ?')
            .all(sessionId);
        const results = [];
        for (const row of rows) {
            const emb = deserializeEmbedding(row.content_embedding);
            const similarity = cosineSimilarity(queryEmbedding, emb);
            if (similarity >= threshold) {
                results.push({
                    id: row.id,
                    sessionId: row.session_id,
                    role: row.role,
                    content: row.content,
                    summary: row.summary,
                    similarity,
                });
            }
        }
        results.sort((a, b) => b.similarity - a.similarity);
        return results;
    }
    /**
     * 根据消息 ID 获取 content embedding（用于后续比对）。
     */
    getContentEmbedding(id) {
        this.init();
        const row = this.db
            .prepare('SELECT content_embedding FROM message_embeddings WHERE id = ?')
            .get(id);
        if (!row)
            return null;
        return deserializeEmbedding(row.content_embedding);
    }
    /**
     * 获取某个 session 中已有的最大 message_index。
     */
    getMaxMessageIndex(sessionId) {
        this.init();
        const row = this.db
            .prepare('SELECT MAX(message_index) as max_idx FROM message_embeddings WHERE session_id = ?')
            .get(sessionId);
        return row?.max_idx ?? -1;
    }
    /**
     * 获取记录总数（用于性能监控）。
     */
    get count() {
        this.init();
        const row = this.db
            .prepare('SELECT COUNT(*) as cnt FROM message_embeddings')
            .get();
        return row.cnt;
    }
    /**
     * 列出所有已知 session ID（用于跨 session 检索）。
     */
    listSessions() {
        this.init();
        const rows = this.db
            .prepare('SELECT DISTINCT session_id FROM message_embeddings ORDER BY session_id')
            .all();
        return rows.map(r => r.session_id);
    }
    /**
     * 注意：不再单独关闭数据库连接，由全局 closeSharedDb() 管理。
     */
    close() {
        // 共享连接不在此关闭
    }
}
// ── 全局单例 ──
let storeInstance = null;
/** 获取全局 VectorStore 单例。 */
export function getVectorStore() {
    if (!storeInstance) {
        storeInstance = new VectorStore();
    }
    return storeInstance;
}
/** 重置单例（用于测试）。 */
export function resetVectorStore() {
    storeInstance = null;
}
//# sourceMappingURL=store.js.map