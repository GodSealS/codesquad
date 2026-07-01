/**
 * 语义上下文组装器 — 三明治架构第二层
 *
 * 语义过滤 + 回填 + tool-result 保护。
 * 从历史消息中选择与用户输入语义最相关的 N 条，保持时间线正确。
 *
 * 🔧 Fix E: 一次 embed 多路分发（userEmbedding 参数复用）
 *
 * Step 5 / 18 执行步骤
 */
import { cosineSimilarity as computeCosine } from '../embedding/store.js';
import { isSemanticEnabled, getEmbeddingProvider } from '../embedding/provider.js';
import { loadSettings } from '../chat/settings.js';
// ── 核心函数 ──
/**
 * 从历史消息中选出与用户输入语义最相关的 N 条。
 *
 * 保留策略：
 * 1. 最近 5 条始终保留（时间局部性）
 * 2. system 消息始终保留
 * 3. tool-result 消息回填（与相应 tool_call 配对）
 * 4. 剩余配额用语义相似度 Top-N 填充
 *
 * 🔧 Fix E: 接受可选的预计算 userEmbedding 避免重复 embed
 *
 * @returns 选中的消息列表（按原始时间顺序排列）
 */
export async function assembleSemanticContext(userInput, messages, options) {
    const { targetCount, similarityThreshold, provider, userEmbedding } = options;
    if (messages.length <= targetCount) {
        return [...messages];
    }
    // 1) 预计算用户输入 embedding（如果未提供）
    const queryEmb = userEmbedding ?? (await provider.embed(userInput));
    // 2) 分类消息
    const recentCount = Math.min(5, targetCount);
    const total = messages.length;
    // 最近 N 条（时间局部性保证）
    const recent = messages.slice(-recentCount);
    // 剩余候选（排除最近 N 条）
    const candidates = messages.slice(0, total - recentCount);
    // 🔧 Bug Fix #7: 调用方已过滤 system 消息，此处简化（防御性保留注释）
    // 所有候选消息直接做语义匹配（callers filter system before passing）
    // 3) 批量计算剩余候选的相似度（🔧 Bug Fix: 使用 embedBatch 替代逐条 embed）
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
    // 4) 按相似度降序排序，取 Top-N
    scored.sort((a, b) => b.similarity - a.similarity);
    const remainingSlots = targetCount - recent.length;
    const topSemantic = scored
        .slice(0, Math.max(0, remainingSlots))
        .map(s => s.message);
    // 5) 合并所有选中消息
    const selected = new Set();
    const result = [];
    // 语义相关消息
    for (const msg of topSemantic) {
        if (!selected.has(msg.index)) {
            selected.add(msg.index);
            result.push(msg);
        }
    }
    // 最近消息（时间局部性保证）
    for (const msg of recent) {
        if (!selected.has(msg.index)) {
            selected.add(msg.index);
            result.push(msg);
        }
    }
    // 6) 回填 tool-result（保证与对应 tool_call 在时间线上正确排列）
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
 * 如果 semanticContext 未启用或消息太少，回退到时间窗口。
 *
 * @param userInput 用户最新输入
 * @param messages 当前 session 的所有消息
 * @returns 应注入 system prompt 上文的消息列表
 */
export async function getSemanticMessages(userInput, messages) {
    const settings = loadSettings();
    const sc = settings.semanticContext;
    // 纯时间窗口条件
    if (!isSemanticEnabled()) {
        return {
            messages: messages.slice(-sc.contextMessageLimit),
            fromSemantic: false,
        };
    }
    if (messages.length <= 30) {
        return {
            messages: [...messages],
            fromSemantic: false,
        };
    }
    if (!sc.features.semanticFilter) {
        return {
            messages: messages.slice(-sc.contextMessageLimit),
            fromSemantic: false,
        };
    }
    const provider = await getEmbeddingProvider(sc.embeddingModel);
    if (!provider) {
        return {
            messages: messages.slice(-sc.contextMessageLimit),
            fromSemantic: false,
        };
    }
    const userEmb = await provider.embed(userInput);
    const filtered = await assembleSemanticContext(userInput, messages, {
        targetCount: sc.contextMessageLimit,
        similarityThreshold: sc.similarityThreshold,
        provider,
        userEmbedding: userEmb,
    });
    return { messages: filtered, fromSemantic: true };
}
//# sourceMappingURL=semantic-context.js.map