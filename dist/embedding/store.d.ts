/**
 * VectorStore — SQLite 向量存储 + 余弦相似度搜索
 *
 * 管理消息 embedding 的 CRUD，提供跨 session 的语义搜索。
 * 初期策略：全量加载到内存计算余弦相似度（<10000 条时 <5ms）。
 * 后期可升级为 sqlite-vec KNN 索引。
 *
 * Step 2 / 18 执行步骤
 */
import type { EmbeddingRecord, SimilarityResult } from './types.js';
/**
 * 将 Float32Array 序列化为 Buffer（用于 SQLite BLOB 存储）。
 */
export declare function serializeEmbedding(emb: Float32Array): Buffer;
/**
 * 将 SQLite BLOB 反序列化为 Float32Array。
 */
export declare function deserializeEmbedding(buf: Buffer): Float32Array;
/**
 * 计算两个向量的余弦相似度。
 */
export declare function cosineSimilarity(a: Float32Array, b: Float32Array): number;
export declare class VectorStore {
    private db;
    private initialized;
    constructor(dbPathOverride?: string);
    /** 初始化表结构（幂等）。 */
    init(): void;
    /**
     * 插入或更新单条 embedding 记录。
     */
    upsert(record: EmbeddingRecord): void;
    /**
     * 批量 upsert（事务包装）。
     */
    batchUpsert(records: EmbeddingRecord[]): void;
    /**
     * 按 sessionId 删除所有相关 embedding。
     */
    deleteBySession(sessionId: string): void;
    /**
     * 余弦相似度搜索（全量加载到内存）。
     *
     * @param queryEmbedding 查询向量
     * @param threshold 相似度阈值 [0,1]
     * @param limit 返回的最大结果数
     * @param excludeSessionId 排除的 session（通常为当前 session）
     */
    searchSimilar(queryEmbedding: Float32Array, threshold: number, limit: number, excludeSessionId?: string): SimilarityResult[];
    /**
     * 在指定 session 内搜索相似消息。
     */
    searchBySession(sessionId: string, queryEmbedding: Float32Array, threshold: number): SimilarityResult[];
    /**
     * 根据消息 ID 获取 content embedding（用于后续比对）。
     */
    getContentEmbedding(id: string): Float32Array | null;
    /**
     * 获取某个 session 中已有的最大 message_index。
     */
    getMaxMessageIndex(sessionId: string): number;
    /**
     * 获取记录总数（用于性能监控）。
     */
    get count(): number;
    /**
     * 列出所有已知 session ID（用于跨 session 检索）。
     */
    listSessions(): string[];
    /**
     * 注意：不再单独关闭数据库连接，由全局 closeSharedDb() 管理。
     */
    close(): void;
}
/** 获取全局 VectorStore 单例。 */
export declare function getVectorStore(): VectorStore;
/** 重置单例（用于测试）。 */
export declare function resetVectorStore(): void;
//# sourceMappingURL=store.d.ts.map