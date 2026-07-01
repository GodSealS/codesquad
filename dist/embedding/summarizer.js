/**
 * 摘要器 — 双后端 + fire-and-forget + enabled gate
 *
 * 为每条 user/assistant 消息生成 ≤200 字符摘要，
 * 异步写入 VectorStore（不阻塞对话流）。
 *
 * 🔧 Fix A: summarizeMessageAsync 入口 isSemanticEnabled 守卫
 * 🔧 Fix H: 双后端（local-qwen / online）
 * 🔧 Fix D: CODESQUAD_LITE=1 → Qwen2.5-1.5B（1.0GB），否则 3B（2.0GB）
 * 🔧 Migration: node-llama-cpp 替代 Ollama
 *
 * Step 4 / 18 执行步骤
 */
import { isSemanticEnabled, getEmbeddingProvider } from './provider.js';
import { getVectorStore } from './store.js';
import { loadSettings } from '../chat/settings.js';
import { existsSync } from 'fs';
import { qwenModelPath } from './downloader.js';
import { getLlamaOnce } from './llama-singleton.js';
// ── Ollama 兼容配置 ──
const OLLAMA_BASE_URL = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
/** 🔧 Fix D: LITE 模式使用 1.5B 模型节省内存 */
function getQwenOllamaModel() {
    if (process.env.CODESQUAD_LITE === '1') {
        return 'qwen2.5:1.5b';
    }
    return 'qwen2.5:3b';
}
const SUMMARIZE_PROMPT = `Summarize the following message in under 200 characters.
Preserve file names, function names, and key parameters.
Return ONLY the summary text, no prefixes or labels.

Message role: {role}
Message content: {content}

Summary:`;
// ── 本地 Qwen Summarizer ──
class LocalQwenSummarizer {
    backend = 'local-qwen';
    model = null;
    wokeUp = false;
    useOllama = false;
    async summarize(text, role) {
        await this.ensureWarm();
        const prompt = SUMMARIZE_PROMPT
            .replace('{role}', role)
            .replace('{content}', text.slice(0, 2000));
        if (this.useOllama) {
            return this.summarizeViaOllama(prompt, text);
        }
        return this.summarizeViaNodeLlamaCpp(prompt, text);
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
        this.model = null;
        this.wokeUp = false;
        this.useOllama = false;
    }
    // ── node-llama-cpp 路径 ──
    async warmupViaNodeLlamaCpp() {
        const path = qwenModelPath();
        if (!existsSync(path)) {
            throw new Error(`[Summarizer] Qwen GGUF not found at ${path}. Please download the model first.`);
        }
        const llama = await getLlamaOnce();
        this.model = await llama.loadModel({ modelPath: path });
        this.useOllama = false;
        this.wokeUp = true;
        console.log('[Summarizer] local Qwen loaded via node-llama-cpp');
    }
    async summarizeViaNodeLlamaCpp(prompt, text) {
        try {
            const typedModel = this.model;
            const typedModule = await import('node-llama-cpp');
            const LlamaChatSession = typedModule.LlamaChatSession;
            // 每次创建新的 context + session，避免历史累积
            const ctx = await typedModel.createContext({ contextSize: 4096 });
            const session = new LlamaChatSession({ contextSequence: ctx.getSequence() });
            try {
                const response = await session.prompt(prompt, {
                    maxTokens: 100,
                    temperature: 0.1,
                });
                return response.trim() || fallbackSummary(text);
            }
            finally {
                session.dispose();
                ctx.dispose();
            }
        }
        catch (e) {
            console.warn(`[Summarizer] local Qwen failed: ${e.message}`);
            return fallbackSummary(text);
        }
    }
    // ── Ollama 兼容路径 ──
    async warmupViaOllama() {
        const modelName = getQwenOllamaModel();
        try {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
            if (!response.ok) {
                console.warn(`[Summarizer] Ollama not reachable at ${OLLAMA_BASE_URL}`);
            }
            else {
                const data = (await response.json());
                const hasModel = (data?.models ?? []).some(m => m.name.startsWith(modelName));
                if (!hasModel) {
                    console.warn(`[Summarizer] Model ${modelName} not found. Pull with: ollama pull ${modelName}`);
                }
            }
        }
        catch (e) {
            console.warn(`[Summarizer] warmup failed: ${e.message}`);
        }
        this.useOllama = true;
        this.wokeUp = true;
    }
    async summarizeViaOllama(prompt, text) {
        const modelName = getQwenOllamaModel();
        try {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: modelName,
                    prompt,
                    stream: false,
                    options: {
                        num_predict: 100,
                        temperature: 0.1,
                    },
                }),
            });
            if (!response.ok) {
                console.warn(`[Summarizer] Ollama error ${response.status}`);
                return fallbackSummary(text);
            }
            const data = (await response.json());
            const summary = (data?.response ?? '').trim();
            return summary || fallbackSummary(text);
        }
        catch (e) {
            console.warn(`[Summarizer] local Qwen failed: ${e.message}`);
            return fallbackSummary(text);
        }
    }
    // ── 通用 ──
    async ensureWarm() {
        if (!this.wokeUp)
            await this.warmup();
    }
}
// ── 在线 Summarizer ──
class OnlineSummarizer {
    backend = 'online';
    apiKey;
    baseUrl;
    modelId;
    constructor(config) {
        this.apiKey =
            config?.apiKey ??
                process.env.OPENAI_API_KEY ??
                process.env.DEEPSEEK_API_KEY ??
                '';
        this.baseUrl =
            config?.baseUrl ??
                process.env.OPENAI_BASE_URL ??
                'https://api.openai.com/v1';
        this.modelId = config?.modelId ?? 'gpt-3.5-turbo';
    }
    async summarize(text, role) {
        const prompt = SUMMARIZE_PROMPT
            .replace('{role}', role)
            .replace('{content}', text.slice(0, 2000));
        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.modelId,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 100,
                    temperature: 0.1,
                }),
            });
            if (!response.ok) {
                console.warn(`[Summarizer] online API error ${response.status}`);
                return fallbackSummary(text);
            }
            const data = (await response.json());
            const summary = data?.choices?.[0]?.message?.content?.trim() ?? '';
            return summary || fallbackSummary(text);
        }
        catch (e) {
            console.warn(`[Summarizer] online API failed: ${e.message}`);
            return fallbackSummary(text);
        }
    }
    async warmup() {
        // 在线后端无需预热
    }
    dispose() {
        // 无资源释放
    }
}
// ── 全局状态 ──
let summarizerInstance = null;
/** 🔧 Bug Fix #1+#3: 根据用户 settings 选择 summarizer 后端，warmup 完成后再返回 */
async function getSummarizer() {
    if (!summarizerInstance) {
        const sc = loadSettings().semanticContext;
        if (sc.embeddingModel.type === 'online') {
            summarizerInstance = new OnlineSummarizer();
        }
        else {
            // 先尝试本地 Qwen，失败降级到 OnlineSummarizer
            const local = new LocalQwenSummarizer();
            try {
                await local.warmup();
                summarizerInstance = local;
            }
            catch (e) {
                console.warn(`[Summarizer] local Qwen warmup failed: ${e.message}，降级到 OnlineSummarizer`);
                local.dispose();
                summarizerInstance = new OnlineSummarizer();
            }
        }
    }
    return summarizerInstance;
}
export function switchSummarizerBackend(backend) {
    if (summarizerInstance)
        summarizerInstance.dispose();
    if (backend === 'online') {
        summarizerInstance = new OnlineSummarizer();
    }
    else {
        summarizerInstance = new LocalQwenSummarizer();
    }
}
// ── 公共 API ──
/**
 * 异步生成摘要并写入 VectorStore（fire-and-forget）。
 *
 * 🔧 Fix A: enabled gate
 * 跳过 system 消息和工具调用结果
 */
export async function summarizeMessageAsync(msg, sessionId, msgIndex) {
    // 🔧 Fix A: enabled gate
    if (!isSemanticEnabled())
        return;
    // 跳过无意义的消息
    if (msg.role === 'system')
        return;
    if (msg.content.startsWith('[Tool Result:'))
        return;
    const truncated = msg.content.slice(0, 2000);
    const summarizer = await getSummarizer();
    summarizer
        .summarize(truncated, msg.role)
        .then(async (summary) => {
        const provider = await getEmbeddingProvider();
        if (!provider)
            return;
        const store = getVectorStore();
        const contentEmb = await provider.embed(truncated);
        const summaryEmb = summary
            ? await provider.embed(summary)
            : undefined;
        store.upsert({
            id: `${sessionId}:${msgIndex}`,
            sessionId,
            messageIndex: msgIndex,
            role: msg.role,
            content: truncated,
            summary,
            contentEmbedding: contentEmb,
            summaryEmbedding: summaryEmb,
        });
    })
        .catch(err => {
        // 静默失败：摘要不应阻断对话
        console.debug(`[Summarizer] fire-and-forget failed: ${err.message}`);
    });
}
/**
 * 重置摘要器状态（用于测试）。
 */
export function resetSummarizer() {
    if (summarizerInstance) {
        summarizerInstance.dispose();
        summarizerInstance = null;
    }
}
// ── 帮助函数 ──
/** 摘要降级：简单截断文本作为摘要 */
function fallbackSummary(text) {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= 200)
        return cleaned;
    return cleaned.slice(0, 197) + '...';
}
//# sourceMappingURL=summarizer.js.map