/**
 * 本地 Embedding Provider — bge-m3 via node-llama-cpp (优先) / Ollama (兼容)
 *
 * 优先通过 node-llama-cpp 直接加载 GGUF 模型，备选 Ollama HTTP API。
 * bge-m3 输出 1024 维向量，支持中英文。
 *
 * 兼容开关：CODESQUAD_USE_OLLAMA=1 保留旧 Ollama 路径。
 *
 * Step 1 / 18 执行步骤
 */
import type { EmbeddingProvider, EmbeddingBackend } from './types.js';
export declare class LocalEmbeddingProvider implements EmbeddingProvider {
    readonly backend: EmbeddingBackend;
    readonly dims: number;
    readonly displayName = "Local BGE-M3 (1024d)";
    private embCtx;
    private model;
    private wokeUp;
    private useOllama;
    embed(text: string): Promise<Float32Array>;
    embedBatch(texts: string[]): Promise<Float32Array[]>;
    warmup(): Promise<void>;
    dispose(): void;
    static create(_modelName?: string): Promise<LocalEmbeddingProvider>;
    private warmupViaNodeLlamaCpp;
    private warmupViaOllama;
    private embedViaOllama;
    private ensureWarm;
}
//# sourceMappingURL=local.d.ts.map