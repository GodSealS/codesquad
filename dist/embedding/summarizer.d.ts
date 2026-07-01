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
import type { SummarizerBackend } from './types.js';
export declare function switchSummarizerBackend(backend: SummarizerBackend): void;
/**
 * 异步生成摘要并写入 VectorStore（fire-and-forget）。
 *
 * 🔧 Fix A: enabled gate
 * 跳过 system 消息和工具调用结果
 */
export declare function summarizeMessageAsync(msg: {
    role: string;
    content: string;
}, sessionId: string, msgIndex: number): Promise<void>;
/**
 * 重置摘要器状态（用于测试）。
 */
export declare function resetSummarizer(): void;
//# sourceMappingURL=summarizer.d.ts.map