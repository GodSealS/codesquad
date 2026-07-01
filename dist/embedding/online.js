/**
 * 在线 Embedding Provider — OpenAI 兼容协议
 *
 * 通过 HTTP API 调用在线 embedding 服务（OpenAI / DeepSeek 等兼容接口）。
 * 🔧 Fix I: safeEmbed() 容错（404→降级 / 429→退避重试 / 其他→null）
 *
 * Step 1 / 18 执行步骤
 */
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMS = 1536;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
export class OnlineEmbeddingProvider {
    backend = 'online';
    displayName;
    config;
    warmedUp = false;
    constructor(config) {
        this.config = config;
        this.displayName = `Online (${config.modelId})`;
    }
    get dims() {
        return this.config.dimensions;
    }
    async embed(text) {
        const result = await this.safeEmbed(text);
        if (!result) {
            throw new Error(`[Embedding] online embed failed for text (${text.slice(0, 50)}...)`);
        }
        return result;
    }
    async embedBatch(texts) {
        const results = [];
        for (const text of texts) {
            const emb = await this.safeEmbed(text);
            if (emb) {
                results.push(emb);
            }
            else {
                // 🔧 Fix I: batch 中单条失败用零向量占位，不中断整批
                results.push(new Float32Array(this.dims));
            }
        }
        return results;
    }
    async warmup() {
        if (this.warmedUp)
            return;
        // 发送一个轻量请求验证连接可用
        await this.safeEmbed('warmup');
        this.warmedUp = true;
    }
    dispose() {
        this.warmedUp = false;
    }
    // ── 🔧 Fix I: safeEmbed 容错 ──
    async safeEmbed(text) {
        let lastError = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await fetch(`${this.config.baseUrl}/embeddings`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${this.config.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: this.config.modelId,
                        input: text,
                        dimensions: this.config.dimensions,
                    }),
                });
                // 404 → 模型不存在，降级失败
                if (response.status === 404) {
                    console.warn(`[Embedding] online model "${this.config.modelId}" not found (404), degrading`);
                    return null;
                }
                // 429 → 退避重试
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    const delay = retryAfter
                        ? parseInt(retryAfter, 10) * 1000
                        : RETRY_DELAY_MS * Math.pow(2, attempt);
                    console.warn(`[Embedding] rate limited (429), retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
                    await sleep(delay);
                    continue;
                }
                if (!response.ok) {
                    const body = await response.text().catch(() => '');
                    console.warn(`[Embedding] online API error ${response.status}: ${body.slice(0, 200)}`);
                    return null;
                }
                const data = (await response.json());
                if (!data?.data?.[0]?.embedding) {
                    console.warn('[Embedding] unexpected response format');
                    return null;
                }
                return new Float32Array(data.data[0].embedding);
            }
            catch (e) {
                lastError = e instanceof Error ? e : new Error(String(e));
                if (attempt < MAX_RETRIES) {
                    const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
                    console.warn(`[Embedding] network error, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES}): ${lastError.message}`);
                    await sleep(delay);
                }
            }
        }
        console.warn(`[Embedding] all retries exhausted: ${lastError?.message ?? 'unknown'}`);
        return null;
    }
    // ── Factory ──
    static async create(modelId, overrides) {
        const apiKey = overrides?.apiKey ??
            process.env.OPENAI_API_KEY ??
            process.env.DEEPSEEK_API_KEY ??
            '';
        const baseUrl = overrides?.baseUrl ??
            process.env.OPENAI_BASE_URL ??
            DEFAULT_BASE_URL;
        const model = modelId ?? overrides?.modelId ?? DEFAULT_MODEL;
        // 根据模型推断维度（常见模型的默认维度）
        const dimensions = overrides?.dimensions ?? inferDimensions(model);
        const config = {
            providerId: detectProvider(baseUrl),
            modelId: model,
            apiKey,
            baseUrl,
            dimensions,
        };
        return new OnlineEmbeddingProvider(config);
    }
}
// ── Helpers ──
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function detectProvider(baseUrl) {
    if (baseUrl.includes('openai.com'))
        return 'openai';
    if (baseUrl.includes('deepseek'))
        return 'deepseek';
    if (baseUrl.includes('anthropic'))
        return 'anthropic';
    return 'custom';
}
function inferDimensions(modelId) {
    // OpenAI 模型维度映射
    if (modelId.includes('text-embedding-3-large'))
        return 3072;
    if (modelId.includes('text-embedding-3-small'))
        return 1536;
    if (modelId.includes('text-embedding-ada-002'))
        return 1536;
    // DeepSeek 等兼容接口默认 1536
    return DEFAULT_DIMS;
}
//# sourceMappingURL=online.js.map