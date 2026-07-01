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
import type { EmbeddingProvider } from '../embedding/types.js';
/** 简化的消息接口（与 agent-runner 的 Message 类型对齐） */
export interface SemanticMessage {
    role: string;
    content: string;
    /** 消息在对话中的原始索引 */
    index: number;
}
export interface AssembleOptions {
    /** 目标保留消息数 */
    targetCount: number;
    /** 相似度阈值 [0, 1] */
    similarityThreshold: number;
    /** Embedding 提供者 */
    provider: EmbeddingProvider;
    /** 预计算的用户输入 embedding（复用，避免重复计算） */
    userEmbedding?: Float32Array;
}
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
export declare function assembleSemanticContext(userInput: string, messages: SemanticMessage[], options: AssembleOptions): Promise<SemanticMessage[]>;
/**
 * 回填 tool-result 消息。
 * 如果一条 tool_call 消息（role=assistant, 包含 tool_calls）被选中，
 * 确保其后的 tool-result 消息也被包含，以保证对话上下文完整。
 */
export declare function mergeWithToolResults(selected: SemanticMessage[], allMessages: SemanticMessage[]): SemanticMessage[];
/**
 * 高层 API：为 agent-runner 提供语义上下文。
 *
 * 如果 semanticContext 未启用或消息太少，回退到时间窗口。
 *
 * @param userInput 用户最新输入
 * @param messages 当前 session 的所有消息
 * @returns 应注入 system prompt 上文的消息列表
 */
export declare function getSemanticMessages(userInput: string, messages: SemanticMessage[]): Promise<{
    messages: SemanticMessage[];
    fromSemantic: boolean;
}>;
//# sourceMappingURL=semantic-context.d.ts.map