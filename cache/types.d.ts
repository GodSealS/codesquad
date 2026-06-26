/**
 * DiskCache 类型定义
 *
 * 文件元数据缓存，存储位置: ${projectRoot}/.codesquad/TEMP/
 * 每个文件对应一个 <contentHash>.json 文件
 * 首位 _accessedAt 时间戳驱动 LRU 清理
 */
/** 磁盘缓存条目 */
export interface DiskCacheEntry {
    /** 末次访问时间戳 (ms) */
    _accessedAt: number;
    /** 创建时间戳 (ms) */
    _createdAt: number;
    /** 源文件路径（相对于项目根） */
    filePath: string;
    /** 源文件大小 (bytes) */
    fileSizeBytes: number;
    /** 源文件行数 */
    lineCount: number;
    /** 源文件字符数 */
    charCount: number;
    /** 文件头部内容（用于摘要，默认前 50 行） */
    head: string;
    /** 文件功能描述（从头部注释/文档提取，≤100 字，用于快速定位） */
    description: string;
    /** 从 head 中提取的关键词 */
    keywords: string[];
    /** 源文件 mtime（用于失效判断） */
    sourceMtimeMs: number;
    /** 源文件内容哈希（SHA256 前 16 字符，用于快速校验） */
    contentHash: string;
}
/** 缓存清理结果 */
export interface CleanStaleResult {
    /** 删除的文件数 */
    deleted: number;
    /** 释放的字节数 */
    freedBytes: number;
    /** 清理耗时 (ms) */
    durationMs: number;
}
/** 缓存统计 */
export interface DiskCacheStats {
    /** 缓存条目总数 */
    totalEntries: number;
    /** 缓存总大小 (bytes) */
    totalSizeBytes: number;
    /** 过期条目数（_accessedAt 超过 maxAge 的） */
    staleCount: number;
    /** 缓存目录路径 */
    cacheDir: string;
}
/** Manifest 条目（轻量索引，用于快速遍历） */
export interface ManifestEntry {
    /** 源文件路径 */
    filePath: string;
    /** 缓存文件路径（相对 manifest） */
    cacheFile: string;
    /** 末次访问时间戳 */
    accessedAt: number;
    /** 创建时间戳 */
    createdAt: number;
    /** 缓存文件大小 */
    sizeBytes: number;
    /** 文件功能描述（≤100 字） */
    description: string;
}
/** Manifest 文件结构 */
export interface CacheManifest {
    /** 版本号 */
    version: number;
    /** 上次清理时间 */
    lastCleanupAt: number | null;
    /** 条目索引 */
    entries: ManifestEntry[];
}
/** DiskCache 配置 */
export interface DiskCacheConfig {
    /** 项目根目录（用于计算 .codesquad/TEMP/ 路径） */
    projectRoot: string;
    /** head 截取行数，默认 50 */
    headLines?: number;
    /** 每个缓存条目最大字节，默认 64KB */
    maxEntryBytes?: number;
    /** 缓存目录名，默认 TEMP */
    cacheDirName?: string;
}
//# sourceMappingURL=types.d.ts.map