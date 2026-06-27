/**
 * Cache Manifest 管理
 *
 * manifest.json 是 DiskCache 的全局索引文件，存储所有缓存条目的轻量元数据。
 * 用于加速 cleanStale 遍历和 stats 统计，避免每次遍历整个缓存目录。
 *
 * 存储位置: ${projectRoot}/.codesquad/TEMP/manifest.json
 */
import type { CacheManifest, ManifestEntry } from './types.js';
import type { TaskResult } from '../core/task-result.js';
/** 获取 manifest 文件路径 */
export declare function manifestPath(cacheDir: string): string;
/**
 * 读取 manifest.json
 * 文件不存在或损坏时返回空的 manifest
 */
export declare function readManifest(cacheDir: string): Promise<CacheManifest>;
/**
 * 原子写入 manifest.json
 * 使用临时文件 + rename 确保写入不会破坏已有数据
 */
export declare function writeManifest(cacheDir: string, manifest: CacheManifest): Promise<void>;
/**
 * 向 manifest 添加或更新条目
 * - 如果 filePath 已存在，更新其 accessedAt/createdAt/sizeBytes
 * - 如果不存在，追加新条目
 */
export declare function upsertManifestEntry(cacheDir: string, entry: ManifestEntry): Promise<void>;
/**
 * 从 manifest 中删除指定 filePath 的条目
 */
export declare function removeManifestEntry(cacheDir: string, filePath: string): Promise<void>;
/**
 * 批量删除 manifest 中的条目（按 filePath 列表）
 */
export declare function removeManifestEntries(cacheDir: string, filePaths: Set<string>): Promise<void>;
/**
 * 更新清理时间戳
 */
export declare function updateCleanupTimestamp(cacheDir: string): Promise<void>;
/**
 * 原子写入 manifest.json，返回 TaskResult。
 */
export declare function writeManifestWithResult(cacheDir: string, manifest: CacheManifest): Promise<TaskResult<null>>;
/**
 * 添加或更新 manifest 条目，返回 TaskResult。
 */
export declare function upsertManifestEntryWithResult(cacheDir: string, entry: ManifestEntry): Promise<TaskResult<null>>;
/**
 * 删除 manifest 条目，返回 TaskResult。
 */
export declare function removeManifestEntryWithResult(cacheDir: string, filePath: string): Promise<TaskResult<null>>;
/**
 * 批量删除 manifest 条目，返回 TaskResult。
 */
export declare function removeManifestEntriesWithResult(cacheDir: string, filePaths: Set<string>): Promise<TaskResult<null>>;
/**
 * 更新清理时间戳，返回 TaskResult。
 */
export declare function updateCleanupTimestampWithResult(cacheDir: string): Promise<TaskResult<null>>;
//# sourceMappingURL=manifest.d.ts.map