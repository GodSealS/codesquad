/**
 * Embedding 模型 API — 下载 / 状态 / 能力查询
 *
 * POST /api/models/download-embedding  — SSE 进度流下载 bge-m3
 * POST /api/models/download-qwen       — SSE 进度流下载 Qwen summarizer
 * GET  /api/models/embedding-status     — 返回下载状态
 * GET  /api/models/embedding-capable    — 返回支持的 embedding 模型列表
 *
 * Step 3 / 18 执行步骤
 * 🔧 Migration: Qwen 状态从 Ollama API 查询改为 GGUF 文件存在性检测
 */
import type http from 'http';
export declare function handleDownloadEmbedding(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
export declare function handleDownloadQwen(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
export declare function handleEmbeddingStatus(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
export declare function handleEmbeddingCapable(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
//# sourceMappingURL=embedding-models.d.ts.map