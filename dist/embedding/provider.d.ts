/**
 * Embedding Provider 工厂 — 多后端路由 + 单例 + LRU Cache
 *
 * 提供统一入口：isSemanticEnabled() / getEmbeddingProvider()。
 * 上层代码无需感知后端差异。
 *
 * 🔧 Fix C: warmup() 入口 isSemanticEnabled 守卫
 * 🔧 Fix G: 本地加载失败 → 自动尝试在线降级链
 * 🔧 R2-5: EmbeddingCache LRU（500 条 / 1min TTL / 内容寻址）
 *
 * Step 1 / 18 执行步骤
 */
import type { EmbeddingProvider, EmbeddingBackend } from './types.js';
export { LocalEmbeddingProvider } from './local.js';
export { OnlineEmbeddingProvider } from './online.js';
export type { EmbeddingProvider, EmbeddingBackend, SimilarityResult, EmbeddingRecord, SemanticContextConfig, SemanticFeatures, OnlineEmbeddingConfig, } from './types.js';
/**
 * 🔧 Fix C: 语义检索总开关。
 * CLI智能增强 + semanticContext.enabled 双重门控。
 * 为 false 时所有 embedding 操作应短路。
 */
export declare function isSemanticEnabled(): boolean;
/**
 * 获取全局单例 EmbeddingProvider。
 *
 * 🔧 Fix C: enabled=false 时返回 null
 * 🔧 Fix G: 本地加载失败 → 自动尝试在线降级
 *
 * @param config 可选后端类型和模型 ID
 */
export declare function getEmbeddingProvider(config?: {
    type?: EmbeddingBackend;
    modelId?: string;
}): Promise<EmbeddingProvider | null>;
/**
 * 切换后端（释放旧实例，下次 getEmbeddingProvider 创建新的）。
 */
export declare function switchProvider(): void;
/**
 * 重置所有状态（用于测试）。
 */
export declare function resetEmbeddingState(): void;
//# sourceMappingURL=provider.d.ts.map