/**
 * 语义上下文检索系统 — 类型契约层
 *
 * 定义所有 Phase 共享的类型接口，确保后续步骤可以并行开发而不会接口冲突。
 * Step 0 / 18 执行步骤
 */
/** Embedding 后端类型 */
export type EmbeddingBackend = 'local-bge-m3' | 'online';
/** Summarizer 后端类型 */
export type SummarizerBackend = 'local-qwen' | 'online';
/**
 * Embedding 提供者接口。
 * 上层调用代码通过此接口操作，无需感知底层是本地模型还是在线 API。
 */
export interface EmbeddingProvider {
    /** 向量维度 */
    readonly dims: number;
    /** 后端类型 */
    readonly backend: EmbeddingBackend;
    /** 显示名称（用于 UI 和日志） */
    readonly displayName: string;
    /** 对单条文本生成 embedding */
    embed(text: string): Promise<Float32Array>;
    /** 批量生成 embedding */
    embedBatch(texts: string[]): Promise<Float32Array[]>;
    /** 预热：加载模型 / 建立连接 */
    warmup(): Promise<void>;
    /** 释放资源 */
    dispose(): void;
}
export interface OnlineEmbeddingConfig {
    /** 提供商标识，如 'openai' / 'deepseek' */
    providerId: string;
    /** 模型 ID，如 'text-embedding-3-small' */
    modelId: string;
    /** API 密钥 */
    apiKey: string;
    /** API 基础 URL */
    baseUrl: string;
    /** 输出维度 */
    dimensions: number;
}
export interface SimilarityResult {
    /** 记录 ID，格式 `{sessionId}:{messageIndex}` */
    id: string;
    /** 所属会话 ID */
    sessionId: string;
    /** 消息角色 */
    role: string;
    /** 消息内容（截断后） */
    content: string;
    /** 摘要 */
    summary: string;
    /** 余弦相似度 [0, 1] */
    similarity: number;
}
export interface EmbeddingRecord {
    id: string;
    sessionId: string;
    messageIndex: number;
    role: string;
    content: string;
    summary: string;
    contentEmbedding: Float32Array;
    summaryEmbedding?: Float32Array;
}
export interface CodeChunk {
    id: string;
    filePath: string;
    startLine: number;
    endLine: number;
    content: string;
    summary: string;
    symbols: string;
    embedding?: Float32Array;
}
export interface CodeSearchResult {
    id: string;
    filePath: string;
    startLine: number;
    endLine: number;
    content: string;
    summary: string;
    symbols: string;
    similarity: number;
}
export interface SummarizerProvider {
    /** 后端类型 */
    readonly backend: SummarizerBackend;
    /** 生成摘要 */
    summarize(text: string, role: string): Promise<string>;
    /** 预热 */
    warmup(): Promise<void>;
    /** 释放 */
    dispose(): void;
}
export interface SemanticContextConfig {
    /** 全局总开关（CLI智能增强必须同时开启才生效） */
    enabled: boolean;
    /** Embedding 模型配置 */
    embeddingModel: {
        type: EmbeddingBackend;
        modelId?: string;
    };
    /** 语义过滤相似度百分比 (0-100)，默认 35（内部转换为 0.35 的 cosine 阈值） */
    similarityThresholdPercent: number;
    /** 匹配源上下文条数 — 用于查询向量的最近 N 条消息，同时也是语义过滤激活门槛 (5-20)，默认 5 */
    queryContextLength: number;
    /** 上下文注入消息数量上限 (5-50)，默认 20。超出的消息由语义过滤筛选 */
    contextMessageLimit: number;
    /** 路由相似度阈值 [0, 1]（内部使用，不暴露百分比） */
    routingThreshold: number;
    /** 功能级开关 */
    features: SemanticFeatures;
}
export interface SemanticFeatures {
    /** Phase 3: 语义过滤 */
    semanticFilter: boolean;
    /** Phase 7: Agent/Skill 智能路由 */
    agentRouting: boolean;
    /** Phase 8: 代码语义搜索 */
    codeRAG: boolean;
    /** Phase 9: Few-Shot 示例注入 */
    exampleInjection: boolean;
    /** Phase 10: 文档自动关联 */
    docAssociation: boolean;
    /** Phase 13: 工具调用智能去重 */
    toolDedup: boolean;
}
export interface AnomalyReport {
    type: 'tool-loop' | 'topic-drift' | 'quality-drop';
    severity: 'warning' | 'critical';
    message: string;
    timestamp: string;
}
export interface DocChunk {
    id: string;
    filePath: string;
    content: string;
    embedding?: Float32Array;
    contentHash: string;
}
export interface FewShotExample {
    id: string;
    sessionId: string;
    userInput: string;
    assistantOutput: string;
    quality: 1 | 2 | 3 | 4 | 5;
    embedding?: Float32Array;
    createdAt: string;
}
export interface SessionCluster {
    id: string;
    topic: string;
    sessionIds: string[];
    centroidEmbedding: Float32Array;
    knowledgeItems: string[];
}
export interface EmbeddingCacheEntry {
    embedding: Float32Array;
    createdAt: number;
}
export interface ToolDedupRecord {
    toolName: string;
    semanticKey: string;
    result: unknown;
    cachedAt: number;
    ttl: number;
    /** Read 工具：记录文件 mtime */
    fileMtime?: number;
}
//# sourceMappingURL=types.d.ts.map