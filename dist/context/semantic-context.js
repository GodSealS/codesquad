/**
 * 语义上下文组装器 — 三明治架构第二层
 *
 * 语义过滤 + 回填 + tool-result 保护。
 * 从历史消息中选择与用户输入语义最相关的消息，基于 token 预算而非消息条数。
 *
 * 🔧 Fix E: 一次 embed 多路分发（userEmbedding 参数复用）
 * 🔧 Fix TOKEN: token 百分比窗口（contextWindowPercent）代替消息条数
 *
 * Step 5 / 18 执行步骤
 */
import { cosineSimilarity as computeCosine } from '../embedding/store.js';
import { isSemanticEnabled, getEmbeddingProvider } from '../embedding/provider.js';
import { loadSettings } from '../chat/settings.js';
import { countTokens } from '../chat/tokenizer.js';
// ── 核心函数 ──
/**
 * 从历史消息中选出与用户输入语义最相关的消息，基于 token 预算。
 *
 * 保留策略：
 * 1. 最近 5 条始终保留（时间局部性）
 * 2. system 消息始终保留
 * 3. tool-result 消息回填（与相应 tool_call 配对）
 * 4. 剩余 token 预算用语义相似度 Top-N 填充
 *
 * 🔧 Fix TOKEN: 基于 maxTokens 预算而非固定消息条数。
 *
 * @returns 选中的消息列表（按原始时间顺序排列）
 */
export async function assembleSemanticContext(userInput, messages, options) {
    const { maxTokens, similarityThreshold, provider, userEmbedding, model } = options;
    // ── 如果总消息的 token 数不超预算，全部保留 ──
    const totalTokens = messages.reduce((sum, m) => sum + countTokens(model, m.content), 0);
    if (totalTokens <= maxTokens) {
        return [...messages];
    }
    // 1) 预计算用户输入 embedding（如果未提供）
    const queryEmb = userEmbedding ?? (await provider.embed(userInput));
    // 2) 最近 5 条始终保留
    const recentCount = Math.min(5, messages.length);
    const recent = messages.slice(-recentCount);
    let usedTokens = recent.reduce((sum, m) => sum + countTokens(model, m.content), 0);
    // 3) 剩余候选 + 语义匹配
    const candidates = messages.slice(0, messages.length - recentCount);
    const scored = [];
    if (candidates.length > 0) {
        const truncatedTexts = candidates.map(m => m.content.slice(0, 2000));
        const batchEmbs = await provider.embedBatch(truncatedTexts);
        for (let i = 0; i < candidates.length; i++) {
            const emb = batchEmbs[i];
            if (!emb)
                continue;
            const similarity = computeCosine(queryEmb, emb);
            if (similarity >= similarityThreshold) {
                scored.push({ message: candidates[i], similarity });
            }
        }
    }
    // 4) 按相似度降序排序，按 token 预算填充
    scored.sort((a, b) => b.similarity - a.similarity);
    const selected = new Set();
    const result = [];
    // Token 预算填充语义相关消息
    for (const s of scored) {
        if (selected.has(s.message.index))
            continue;
        const msgTokens = countTokens(model, s.message.content);
        if (usedTokens + msgTokens > maxTokens)
            break; // token 预算耗尽
        selected.add(s.message.index);
        result.push(s.message);
        usedTokens += msgTokens;
    }
    // 合并最近消息
    for (const msg of recent) {
        if (!selected.has(msg.index)) {
            selected.add(msg.index);
            result.push(msg);
        }
    }
    // 5) 回填 tool-result
    const mergedWithTools = mergeWithToolResults(result, messages);
    // 按原始索引排序
    mergedWithTools.sort((a, b) => a.index - b.index);
    return mergedWithTools;
}
/**
 * 回填 tool-result 消息。
 * 如果一条 tool_call 消息（role=assistant, 包含 tool_calls）被选中，
 * 确保其后的 tool-result 消息也被包含，以保证对话上下文完整。
 */
export function mergeWithToolResults(selected, allMessages) {
    const selectedSet = new Set(selected.map(m => m.index));
    const result = [...selected];
    // 扫描所有消息，找到需要回填的 tool-result
    for (const msg of allMessages) {
        if (msg.role === 'user') {
            // tool-result 消息跟在 tool_call 之后，作为 user 角色的特殊消息
            if (msg.content.startsWith('[Tool Result:') || msg.content.startsWith('[Tool Result]')) {
                // 检查前面是否有被选中的 tool_call
                // 🔧 Bug Fix #12: 扩大到 20 条消息窗口，支持多工具并行调用场景
                const hasSelectedToolCall = allMessages.some(m => m.role === 'assistant' &&
                    selectedSet.has(m.index) &&
                    m.index < msg.index &&
                    msg.index - m.index <= 20);
                if (hasSelectedToolCall && !selectedSet.has(msg.index)) {
                    selectedSet.add(msg.index);
                    result.push(msg);
                }
            }
        }
    }
    return result;
}
// ── 便捷包装：一键式语义上下文组装 ──
/**
 * 高层 API：为 agent-runner 提供语义上下文。
 *
 * 如果 CL智能增强/semanticContext 未启用或消息太少，回退到 token 百分比时间窗口。
 *
 * @param userInput  用户最新输入
 * @param messages   当前 session 的所有消息
 * @param model      LLM 模型名（用于 token 计数和上下文窗口查询）
 * @returns 应注入 system prompt 上文的消息列表
 */
export async function getSemanticMessages(userInput, messages, model) {
    const settings = loadSettings();
    const sc = settings.semanticContext;
    const percent = settings.maxGenerationPercent;
    // 时间窗口回退：按 token 百分比截断
    const timeWindowFallback = () => {
        const { getContextWindow } = require('../context/auto-compact.js');
        const maxTokens = Math.floor(getContextWindow(model) * percent / 100);
        let used = 0;
        const kept = [];
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const t = countTokens(model, msg.content);
            if (used + t > maxTokens)
                break;
            kept.unshift(msg);
            used += t;
        }
        return kept;
    };
    if (!isSemanticEnabled()) {
        return { messages: timeWindowFallback(), fromSemantic: false };
    }
    // queryContextLength：既是语义过滤激活门槛，也是查询源条数
    if (messages.length <= sc.queryContextLength) {
        return { messages: [...messages], fromSemantic: false };
    }
    if (!sc.features.semanticFilter) {
        return { messages: timeWindowFallback(), fromSemantic: false };
    }
    const provider = await getEmbeddingProvider(sc.embeddingModel);
    if (!provider) {
        return { messages: timeWindowFallback(), fromSemantic: false };
    }
    // 计算 token 预算：模型最大上下文 × 百分比
    const { getContextWindow: getCtxWin } = await import('../context/auto-compact.js');
    const maxTokens = Math.floor(getCtxWin(model) * percent / 100);
    // 相似度：百分比 → [0, 1] 浮点
    const simThreshold = sc.similarityThresholdPercent / 100;
    // 用最近 N 条消息拼接做查询源（N = queryContextLength）
    const recentForQuery = messages.slice(-sc.queryContextLength);
    const queryText = recentForQuery.map(m => m.content.slice(0, 500)).join('\n---\n');
    const userEmb = await provider.embed(queryText);
    const filtered = await assembleSemanticContext(userInput, messages, {
        maxTokens,
        similarityThreshold: simThreshold,
        provider,
        userEmbedding: userEmb,
        model,
    });
    return { messages: filtered, fromSemantic: true };
}
//# sourceMappingURL=semantic-context.js.map