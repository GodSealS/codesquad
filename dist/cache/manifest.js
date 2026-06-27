/**
 * Cache Manifest 管理
 *
 * manifest.json 是 DiskCache 的全局索引文件，存储所有缓存条目的轻量元数据。
 * 用于加速 cleanStale 遍历和 stats 统计，避免每次遍历整个缓存目录。
 *
 * 存储位置: ${projectRoot}/.codesquad/TEMP/manifest.json
 */
import { readFile, writeFile, rename, mkdir } from 'fs';
import { promisify } from 'util';
import { join } from 'path';
import { successResult, errorResult } from '../core/task-result.js';
const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);
const renameAsync = promisify(rename);
const mkdirAsync = promisify(mkdir);
const MANIFEST_VERSION = 1;
const MANIFEST_FILENAME = 'manifest.json';
/** 创建空的 manifest 结构 */
function createEmptyManifest() {
    return {
        version: MANIFEST_VERSION,
        lastCleanupAt: null,
        entries: [],
    };
}
/** 获取 manifest 文件路径 */
export function manifestPath(cacheDir) {
    return join(cacheDir, MANIFEST_FILENAME);
}
/**
 * 读取 manifest.json
 * 文件不存在或损坏时返回空的 manifest
 */
export async function readManifest(cacheDir) {
    const path = manifestPath(cacheDir);
    try {
        const raw = await readFileAsync(path, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.entries)) {
            return parsed;
        }
        return createEmptyManifest();
    }
    catch {
        return createEmptyManifest();
    }
}
/**
 * 原子写入 manifest.json
 * 使用临时文件 + rename 确保写入不会破坏已有数据
 */
export async function writeManifest(cacheDir, manifest) {
    await mkdirAsync(cacheDir, { recursive: true });
    const path = manifestPath(cacheDir);
    const tmpPath = `${path}.tmp.${process.pid}`;
    const json = JSON.stringify(manifest);
    await writeFileAsync(tmpPath, json, 'utf-8');
    await renameAsync(tmpPath, path);
}
/**
 * 向 manifest 添加或更新条目
 * - 如果 filePath 已存在，更新其 accessedAt/createdAt/sizeBytes
 * - 如果不存在，追加新条目
 */
export async function upsertManifestEntry(cacheDir, entry) {
    const manifest = await readManifest(cacheDir);
    const idx = manifest.entries.findIndex(e => e.filePath === entry.filePath);
    if (idx >= 0) {
        manifest.entries[idx] = entry;
    }
    else {
        manifest.entries.push(entry);
    }
    await writeManifest(cacheDir, manifest);
}
/**
 * 从 manifest 中删除指定 filePath 的条目
 */
export async function removeManifestEntry(cacheDir, filePath) {
    const manifest = await readManifest(cacheDir);
    manifest.entries = manifest.entries.filter(e => e.filePath !== filePath);
    await writeManifest(cacheDir, manifest);
}
/**
 * 批量删除 manifest 中的条目（按 filePath 列表）
 */
export async function removeManifestEntries(cacheDir, filePaths) {
    if (filePaths.size === 0)
        return;
    const manifest = await readManifest(cacheDir);
    manifest.entries = manifest.entries.filter(e => !filePaths.has(e.filePath));
    await writeManifest(cacheDir, manifest);
}
/**
 * 更新清理时间戳
 */
export async function updateCleanupTimestamp(cacheDir) {
    const manifest = await readManifest(cacheDir);
    manifest.lastCleanupAt = Date.now();
    await writeManifest(cacheDir, manifest);
}
// ── P3: TaskResult-wrapped versions ──
/**
 * 原子写入 manifest.json，返回 TaskResult。
 */
export async function writeManifestWithResult(cacheDir, manifest) {
    const startMs = Date.now();
    try {
        await writeManifest(cacheDir, manifest);
        return successResult(null, { durationMs: Date.now() - startMs });
    }
    catch (err) {
        return errorResult({
            errorCode: 'FILE_WRITE_FAILED',
            message: `Failed to write manifest: ${err.message}`,
            durationMs: Date.now() - startMs,
        });
    }
}
/**
 * 添加或更新 manifest 条目，返回 TaskResult。
 */
export async function upsertManifestEntryWithResult(cacheDir, entry) {
    const startMs = Date.now();
    try {
        await upsertManifestEntry(cacheDir, entry);
        return successResult(null, { durationMs: Date.now() - startMs });
    }
    catch (err) {
        return errorResult({
            errorCode: 'FILE_WRITE_FAILED',
            message: `Failed to upsert manifest entry: ${err.message}`,
            durationMs: Date.now() - startMs,
        });
    }
}
/**
 * 删除 manifest 条目，返回 TaskResult。
 */
export async function removeManifestEntryWithResult(cacheDir, filePath) {
    const startMs = Date.now();
    try {
        await removeManifestEntry(cacheDir, filePath);
        return successResult(null, { durationMs: Date.now() - startMs });
    }
    catch (err) {
        return errorResult({
            errorCode: 'FILE_WRITE_FAILED',
            message: `Failed to remove manifest entry: ${err.message}`,
            durationMs: Date.now() - startMs,
        });
    }
}
/**
 * 批量删除 manifest 条目，返回 TaskResult。
 */
export async function removeManifestEntriesWithResult(cacheDir, filePaths) {
    const startMs = Date.now();
    try {
        await removeManifestEntries(cacheDir, filePaths);
        return successResult(null, { durationMs: Date.now() - startMs });
    }
    catch (err) {
        return errorResult({
            errorCode: 'FILE_WRITE_FAILED',
            message: `Failed to remove manifest entries: ${err.message}`,
            durationMs: Date.now() - startMs,
        });
    }
}
/**
 * 更新清理时间戳，返回 TaskResult。
 */
export async function updateCleanupTimestampWithResult(cacheDir) {
    const startMs = Date.now();
    try {
        await updateCleanupTimestamp(cacheDir);
        return successResult(null, { durationMs: Date.now() - startMs });
    }
    catch (err) {
        return errorResult({
            errorCode: 'FILE_WRITE_FAILED',
            message: `Failed to update cleanup timestamp: ${err.message}`,
            durationMs: Date.now() - startMs,
        });
    }
}
//# sourceMappingURL=manifest.js.map