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
import { loadSettings } from '../chat/settings.js';
// ── 导出子模块类型 ──
export { LocalEmbeddingProvider } from './local.js';
export { OnlineEmbeddingProvider } from './online.js';
// ── LRU Embedding Cache（🔧 R2-5）──
const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 60_000; // 1 minute
class EmbeddingCache {
    store = new Map();
    /** 内容寻址键：基于文本 hash */
    key(text) {
        // 简单 djb2 hash，足够用于缓存键
        let hash = 5381;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
        }
        return `emb:${hash.toString(36)}`;
    }
    get(text) {
        const k = this.key(text);
        const entry = this.store.get(k);
        if (!entry)
            return null;
        const age = Date.now() - entry.createdAt;
        if (age > CACHE_TTL_MS) {
            this.store.delete(k);
            return null;
        }
        // LRU: move to end
        this.store.delete(k);
        this.store.set(k, entry);
        return entry.embedding;
    }
    set(text, embedding) {
        const k = this.key(text);
        // Evict oldest if at capacity
        if (this.store.size >= CACHE_MAX_SIZE) {
            const oldest = this.store.keys().next().value;
            if (oldest)
                this.store.delete(oldest);
        }
        this.store.set(k, {
            embedding,
            createdAt: Date.now(),
        });
    }
    clear() {
        this.store.clear();
    }
    get size() {
        return this.store.size;
    }
}
// ── 缓存包装器 ──
class CachedEmbeddingProvider {
    inner;
    backend;
    displayName;
    cache = new EmbeddingCache();
    constructor(inner) {
        this.inner = inner;
        this.backend = inner.backend;
        this.displayName = inner.displayName;
    }
    get dims() {
        return this.inner.dims;
    }
    async embed(text) {
        const cached = this.cache.get(text);
        if (cached)
            return cached;
        const result = await this.inner.embed(text);
        this.cache.set(text, result);
        return result;
    }
    async embedBatch(texts) {
        const results = [];
        const uncached = [];
        for (let i = 0; i < texts.length; i++) {
            const cached = this.cache.get(texts[i]);
            if (cached) {
                results[i] = cached;
            }
            else {
                uncached.push({ idx: i, text: texts[i] });
            }
        }
        if (uncached.length > 0) {
            const batchResults = await this.inner.embedBatch(uncached.map(u => u.text));
            for (let j = 0; j < uncached.length; j++) {
                const { idx, text } = uncached[j];
                const emb = batchResults[j];
                results[idx] = emb;
                this.cache.set(text, emb);
            }
        }
        return results;
    }
    async warmup() {
        // 🔧 Fix C: 启用检查
        if (!isSemanticEnabled())
            return;
        await this.inner.warmup();
    }
    dispose() {
        this.cache.clear();
        this.inner.dispose();
    }
}
// ── 全局状态 ──
let instance = null;
let instanceConfigKey = null;
// ── 公共 API ──
/**
 * 🔧 Fix C: 语义检索总开关。
 * CLI智能增强 + semanticContext.enabled 双重门控。
 * 为 false 时所有 embedding 操作应短路。
 */
export function isSemanticEnabled() {
    const s = loadSettings();
    return s.cliSmartEnhancement && s.semanticContext.enabled;
}
/**
 * 获取全局单例 EmbeddingProvider。
 *
 * 🔧 Fix C: enabled=false 时返回 null
 * 🔧 Fix G: 本地加载失败 → 自动尝试在线降级
 *
 * @param config 可选后端类型和模型 ID
 */
export async function getEmbeddingProvider(config) {
    // 🔧 Fix C: 总开关关闭
    if (!isSemanticEnabled())
        return null;
    const configKey = `${config?.type ?? 'auto'}:${config?.modelId ?? 'default'}`;
    // 同配置单例复用
    if (instance && instanceConfigKey === configKey) {
        return instance;
    }
    // 释放旧实例
    if (instance) {
        instance.dispose();
        instance = null;
    }
    if (config?.type === 'online' && config.modelId) {
        // 明确指定在线后端
        const { OnlineEmbeddingProvider } = await import('./online.js');
        instance = await OnlineEmbeddingProvider.create(config.modelId);
    }
    else if (config?.type === 'local-bge-m3') {
        // 明确指定本地后端
        try {
            const { LocalEmbeddingProvider } = await import('./local.js');
            instance = await LocalEmbeddingProvider.create('bge-m3');
        }
        catch (e) {
            console.warn(`[Embedding] 本地模型加载失败: ${e.message}`);
            return null;
        }
    }
    else {
        // 🔧 Bug Fix #4: 无参数时根据 settings 选择后端（不再总是先试本地）
        const sc = loadSettings().semanticContext;
        if (sc.embeddingModel.type === 'online' && sc.embeddingModel.modelId) {
            // 用户配置了在线后端 → 直接走在线
            const { OnlineEmbeddingProvider } = await import('./online.js');
            instance = await OnlineEmbeddingProvider.create(sc.embeddingModel.modelId);
        }
        else {
            // 用户配置了本地，或未配置 → 本地 + 在线降级链
            try {
                const { LocalEmbeddingProvider } = await import('./local.js');
                instance = await LocalEmbeddingProvider.create('bge-m3');
            }
            catch (e) {
                console.warn(`[Embedding] 本地模型加载失败，尝试在线降级: ${e.message}`);
                try {
                    const { OnlineEmbeddingProvider } = await import('./online.js');
                    instance = await OnlineEmbeddingProvider.create();
                }
                catch (e2) {
                    console.warn(`[Embedding] 在线降级也失败: ${e2.message}`);
                    return null;
                }
            }
        }
    }
    // 🔧 R2-5: 包装 LRU 缓存
    if (instance) {
        instance = new CachedEmbeddingProvider(instance);
        instanceConfigKey = configKey;
    }
    return instance;
}
/**
 * 切换后端（释放旧实例，下次 getEmbeddingProvider 创建新的）。
 */
export function switchProvider() {
    if (instance) {
        instance.dispose();
        instance = null;
        instanceConfigKey = null;
    }
}
/**
 * 重置所有状态（用于测试）。
 */
export function resetEmbeddingState() {
    switchProvider();
}
//# sourceMappingURL=provider.js.map