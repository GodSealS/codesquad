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
import { existsSync } from 'fs';
import { modelPath } from './downloader.js';
import { getLlamaOnce } from './llama-singleton.js';
const BGE_M3_DIMS = 1024;
const OLLAMA_BASE_URL = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
const OLLAMA_MODEL = 'bge-m3';
export class LocalEmbeddingProvider {
    backend = 'local-bge-m3';
    dims = BGE_M3_DIMS;
    displayName = 'Local BGE-M3 (1024d)';
    embCtx = null;
    model = null;
    wokeUp = false;
    useOllama = false;
    async embed(text) {
        await this.ensureWarm();
        if (this.useOllama) {
            return await this.embedViaOllama(text);
        }
        const ctx = this.embCtx;
        const result = await ctx.getEmbeddingFor(text);
        return new Float32Array(result.vector);
    }
    async embedBatch(texts) {
        await this.ensureWarm();
        const results = [];
        for (const text of texts) {
            const emb = await this.embed(text);
            results.push(emb);
        }
        return results;
    }
    async warmup() {
        if (this.wokeUp)
            return;
        // ── 兼容开关：CODESQUAD_USE_OLLAMA=1 保留旧行为 ──
        if (process.env.CODESQUAD_USE_OLLAMA === '1') {
            await this.warmupViaOllama();
            return;
        }
        // ── 新路径：node-llama-cpp 直接加载 GGUF ──
        await this.warmupViaNodeLlamaCpp();
    }
    dispose() {
        // 🔧 Fix Bug 3: 释放 embCtx + model（显存）
        if (this.embCtx && typeof this.embCtx.dispose === 'function') {
            this.embCtx.dispose();
        }
        if (this.model && typeof this.model.dispose === 'function') {
            this.model.dispose();
        }
        this.embCtx = null;
        this.model = null;
        this.wokeUp = false;
        this.useOllama = false;
    }
    // ── Factory ──
    static async create(_modelName) {
        const provider = new LocalEmbeddingProvider();
        await provider.warmup();
        return provider;
    }
    // ── 内部：node-llama-cpp 路径 ──
    async warmupViaNodeLlamaCpp() {
        const path = modelPath();
        if (!existsSync(path)) {
            throw new Error(`[Embedding] bge-m3 GGUF not found at ${path}. Please download the model first.`);
        }
        const llama = await getLlamaOnce();
        this.model = await llama.loadModel({ modelPath: path });
        const typedModel = this.model;
        this.embCtx = await typedModel.createEmbeddingContext();
        this.useOllama = false;
        this.wokeUp = true;
        console.log('[Embedding] local BGE-M3 loaded via node-llama-cpp');
    }
    // ── 内部：Ollama 兼容路径 ──
    async warmupViaOllama() {
        const available = await checkOllama(OLLAMA_MODEL);
        if (!available) {
            throw new Error(`[Embedding] Ollama not available or model "${OLLAMA_MODEL}" not pulled.\n` +
                `  Run: ollama pull ${OLLAMA_MODEL}`);
        }
        this.useOllama = true;
        this.wokeUp = true;
        console.log(`[Embedding] local BGE-M3 ready (via Ollama @ ${OLLAMA_BASE_URL})`);
    }
    async embedViaOllama(text) {
        try {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: OLLAMA_MODEL,
                    prompt: text,
                }),
            });
            if (!response.ok) {
                console.warn(`[Embedding] Ollama error ${response.status}: ${await response.text().catch(() => '')}`);
                throw new Error(`Ollama returned ${response.status}`);
            }
            const data = (await response.json());
            if (!data?.embedding || !Array.isArray(data.embedding)) {
                throw new Error('[Embedding] Ollama unexpected response format');
            }
            return new Float32Array(data.embedding);
        }
        catch (e) {
            console.warn(`[Embedding] Ollama request failed: ${e.message}`);
            throw e;
        }
    }
    // ── 内部通用 ──
    async ensureWarm() {
        if (!this.wokeUp) {
            await this.warmup();
        }
    }
}
// ── Helpers ──
async function checkOllama(model) {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
        if (!response.ok)
            return false;
        const data = (await response.json());
        const models = data?.models ?? [];
        return models.some(m => m.name.startsWith(model));
    }
    catch {
        // Ollama 未运行或不可达
        return false;
    }
}
//# sourceMappingURL=local.js.map