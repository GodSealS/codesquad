/**
 * 工具调用智能去重 — 语义相同但字面不同的调用复用缓存
 *
 * TTL 策略：
 * - Read: ∞ (基于 mtime) — 文件未修改则缓存永不过期
 * - Glob: 30s — 目录 mtime 检查
 * - Grep: 10s — AI 可能在修改代码
 * - Bash: 0 — 命令执行永不去重
 * - Write/Edit: 0 — 写操作永不去重
 *
 * Step 13 / 18 执行步骤
 */
import { statSync } from 'fs';
import { getSharedDb } from './db.js';
import { TOOL_DEDUP_CACHE_DDL } from './schema.js';
import { isSemanticEnabled } from './provider.js';
// ── TTL 策略 ──
const TOOL_TTL = {
    Read: { ttl: Infinity, checkMtime: true },
    FileReadTool: { ttl: Infinity, checkMtime: true },
    Glob: { ttl: 30_000, checkMtime: true },
    GrepGlobTool: { ttl: 30_000, checkMtime: true },
    Grep: { ttl: 10_000, checkMtime: false },
    Bash: { ttl: 0, checkMtime: false },
    BashTool: { ttl: 0, checkMtime: false },
    FileWriteTool: { ttl: 0, checkMtime: false },
    FileEditTool: { ttl: 0, checkMtime: false },
    Write: { ttl: 0, checkMtime: false },
    Edit: { ttl: 0, checkMtime: false },
};
// ── ToolDedup ──
export class ToolDedup {
    db;
    constructor(dbPathOverride) {
        this.db = getSharedDb(dbPathOverride);
        this.init();
    }
    init() {
        this.db.exec(TOOL_DEDUP_CACHE_DDL);
    }
    /**
     * 检查是否有可复用的缓存结果。
     *
     * @param toolName 工具名称
     * @param toolInput 工具输入的 JSON 字符串
     * @returns 缓存的结果或 null
     */
    async check(toolName, toolInput) {
        if (!isSemanticEnabled())
            return null;
        const ttlConfig = TOOL_TTL[toolName];
        if (!ttlConfig || ttlConfig.ttl === 0)
            return null;
        // 清理过期条目
        this.cleanup();
        const rows = this.db.prepare(/* sql */ `
      SELECT id, semantic_key, result, cached_at, ttl, file_mtime
      FROM tool_dedup_cache
      WHERE tool_name = ?
    `).all(toolName);
        if (rows.length === 0)
            return null;
        const semanticKey = hashString(toolInput);
        for (const row of rows) {
            // 精确 key 匹配（djb2 hash）
            if (row.semantic_key !== semanticKey)
                continue;
            // 检查是否过期
            const age = Date.now() - row.cached_at;
            if (age > row.ttl && row.ttl !== Infinity)
                continue;
            // 检查 mtime（Read 工具）
            if (ttlConfig.checkMtime && row.file_mtime !== null) {
                try {
                    const pathMatch = toolInput.match(/"filePath"\s*:\s*"([^"]+)"/);
                    if (pathMatch?.[1]) {
                        const currentMtime = statSync(pathMatch[1]).mtimeMs;
                        if (currentMtime !== row.file_mtime)
                            continue;
                    }
                }
                catch {
                    continue; // 文件不存在，缓存失效
                }
            }
            try {
                return JSON.parse(row.result);
            }
            catch {
                return null;
            }
        }
        return null;
    }
    /**
     * 记录工具调用结果到缓存。
     */
    async cache(toolName, toolInput, result) {
        const ttlConfig = TOOL_TTL[toolName];
        if (!ttlConfig || ttlConfig.ttl === 0)
            return;
        const semanticKey = hashString(toolInput);
        const id = `dedup:${toolName}:${semanticKey}`;
        let fileMtime = null;
        if (ttlConfig.checkMtime) {
            const pathMatch = toolInput.match(/"filePath"\s*:\s*"([^"]+)"/);
            if (pathMatch?.[1]) {
                try {
                    fileMtime = statSync(pathMatch[1]).mtimeMs;
                }
                catch {
                    // 文件不存在，不记录 mtime
                }
            }
        }
        this.db.prepare(/* sql */ `
      INSERT OR REPLACE INTO tool_dedup_cache
        (id, tool_name, semantic_key, result, cached_at, ttl, file_mtime)
      VALUES
        (@id, @toolName, @semanticKey, @result, @cachedAt, @ttl, @fileMtime)
    `).run({
            id,
            toolName,
            semanticKey,
            result: JSON.stringify(result),
            cachedAt: Date.now(),
            ttl: ttlConfig.ttl === Infinity ? Number.MAX_SAFE_INTEGER : ttlConfig.ttl,
            fileMtime,
        });
    }
    cleanup() {
        const now = Date.now();
        this.db.prepare(/* sql */ `
      DELETE FROM tool_dedup_cache
      WHERE cached_at + ttl < ? AND ttl != ?
    `).run(now, Number.MAX_SAFE_INTEGER);
    }
    clear() {
        this.db.prepare('DELETE FROM tool_dedup_cache').run();
    }
    close() {
        // 共享连接不在此关闭
    }
}
// ── Helpers ──
function hashString(s) {
    let hash = 5381;
    for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
    }
    return hash.toString(36);
}
// ── 全局单例 ──
let dedupInstance = null;
export function getToolDedup() {
    if (!dedupInstance) {
        dedupInstance = new ToolDedup();
    }
    return dedupInstance;
}
export function resetToolDedup() {
    dedupInstance = null;
}
//# sourceMappingURL=tool-dedup.js.map