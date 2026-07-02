/**
 * 模型下载器 — 断点续传 + 进度回调 + SHA256 校验
 *
 * 从 GitHub Release / HuggingFace / Modelscope 镜像下载 bge-m3 / Qwen2.5 GGUF 到 ~/.codesquad/models/。
 * 支持 HTTP Range header 断点续传。
 *
 * Step 3 / 18 执行步骤
 */
export interface DownloadProgress {
    /** 已下载字节数 */
    downloaded: number;
    /** 总字节数 */
    total: number;
    /** 百分比 [0, 100] */
    percent: number;
    /** 下载速度 (bytes/s) */
    speed: number;
    /** 状态 */
    status: 'downloading' | 'verifying' | 'completed' | 'error';
    /** 错误信息（仅 error 状态） */
    error?: string;
}
export type ProgressCallback = (progress: DownloadProgress) => void;
export declare function modelDir(): string;
export declare function modelPath(): string;
export declare function qwenModelDir(): string;
export declare function qwenModelPath(): string;
export interface ModelStatus {
    downloaded: boolean;
    size: number;
    path: string;
    verified: boolean;
}
export declare function getModelStatus(): ModelStatus;
export declare function downloadModel(onProgress?: ProgressCallback): Promise<void>;
export declare function verifyModel(): Promise<boolean>;
/** 确保模型已下载并校验。 */
export declare function ensureModel(): Promise<boolean>;
/** 获取 Qwen 模型状态 */
export declare function getQwenModelStatus(): ModelStatus;
/** 下载 Qwen Summarizer 模型（断点续传 + SSE 进度） */
export declare function downloadQwenModel(onProgress?: ProgressCallback): Promise<void>;
/** 🔧 Fix Bug 4: 验证 Qwen 模型 SHA256 完整性 */
export declare function verifyQwenModel(): Promise<boolean>;
/** 确保 Qwen 模型已下载并校验。校验失败自动重下。 */
export declare function ensureQwenModel(): Promise<boolean>;
//# sourceMappingURL=downloader.d.ts.map