/**
 * 在线 Embedding Provider — OpenAI 兼容协议
 *
 * 通过 HTTP API 调用在线 embedding 服务（OpenAI / DeepSeek 等兼容接口）。
 * 🔧 Fix I: safeEmbed() 容错（404→降级 / 429→退避重试 / 其他→null）
 *
 * Step 1 / 18 执行步骤
 */
import type { EmbeddingProvider, EmbeddingBackend, OnlineEmbeddingConfig } from './types.js';
export declare class OnlineEmbeddingProvider implements EmbeddingProvider {
    readonly backend: EmbeddingBackend;
    readonly displayName: string;
    private config;
    private warmedUp;
    constructor(config: OnlineEmbeddingConfig);
    get dims(): number;
    embed(text: string): Promise<Float32Array>;
    embedBatch(texts: string[]): Promise<Float32Array[]>;
    warmup(): Promise<void>;
    dispose(): void;
    private safeEmbed;
    static create(modelId?: string, overrides?: Partial<OnlineEmbeddingConfig>): Promise<OnlineEmbeddingProvider>;
}
//# sourceMappingURL=online.d.ts.map