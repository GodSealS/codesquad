/**
 * DiskCache — 磁盘二级缓存
 *
 * 在内存缓存 (FileStateCache) 之下提供跨会话的持久化层。
 * 存储位置: ${projectRoot}/.codesquad/TEMP/
 *
 * 设计要点:
 * - 每个源文件对应一个 <contentHash>.json 缓存文件
 * - 缓存文件首位 _accessedAt 时间戳驱动 LRU 清理
 * - 每次访问更新 _accessedAt（touch）
 * - 原子写入（临时文件 + rename）防止损坏
 * - manifest.json 全局索引加速遍历
 *
 * 清理策略:
 * - Web UI 按钮触发 cleanStale(5天)
 * - 删除 _accessedAt 超过阈值 + 对应的 manifest 条目
 */
import { readFile, writeFile, rename, unlink, mkdir, stat } from 'fs';
import { promisify } from 'util';
import { join, relative, resolve, extname } from 'path';
import { createHash } from 'crypto';
import { readManifest, upsertManifestEntry, removeManifestEntry, removeManifestEntries, updateCleanupTimestamp, } from './manifest.js';
const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);
const renameAsync = promisify(rename);
const unlinkAsync = promisify(unlink);
const mkdirAsync = promisify(mkdir);
const statAsync = promisify(stat);
const DEFAULT_HEAD_LINES = 50;
const DEFAULT_MAX_ENTRY_BYTES = 64 * 1024; // 64KB
const DEFAULT_CACHE_DIR_NAME = 'TEMP';
/** 从文件路径生成稳定哈希（SHA256 前 16 字符） */
function hashFilePath(filePath) {
    return createHash('sha256').update(filePath).digest('hex').slice(0, 16);
}
/** 获取 cache 目录路径 */
function cacheDirPath(projectRoot, cacheDirName = DEFAULT_CACHE_DIR_NAME) {
    return resolve(projectRoot, '.codesquad', cacheDirName);
}
/** 从文件内容计算哈希（SHA256 前 16 字符） */
export function hashContent(content) {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
export class DiskCache {
    projectRoot;
    cacheDir;
    headLines;
    maxEntryBytes;
    constructor(config) {
        this.projectRoot = resolve(config.projectRoot);
        this.cacheDir = cacheDirPath(this.projectRoot, config.cacheDirName);
        this.headLines = config.headLines ?? DEFAULT_HEAD_LINES;
        this.maxEntryBytes = config.maxEntryBytes ?? DEFAULT_MAX_ENTRY_BYTES;
    }
    /** 获取 cache 目录路径 */
    getCacheDir() {
        return this.cacheDir;
    }
    /** 确保 cache 目录存在 */
    async ensureDir() {
        await mkdirAsync(this.cacheDir, { recursive: true });
    }
    /** 缓存文件路径（文件名 = 哈希） */
    cacheFilePath(filePath) {
        const hash = hashFilePath(filePath);
        return join(this.cacheDir, `${hash}.json`);
    }
    /** 将源文件路径转为相对于项目根的形式（用于缓存的 filePath 字段） */
    relativePath(filePath) {
        const resolved = resolve(filePath);
        const rel = relative(this.projectRoot, resolved);
        // 如果不在项目内，返回原始绝对路径
        return rel.startsWith('..') ? resolved : rel;
    }
    // ── 核心 API ──
    /**
     * 读取缓存条目
     * 返回 null 表示缓存缺失
     */
    async read(filePath) {
        const cacheFile = this.cacheFilePath(filePath);
        try {
            const raw = await readFileAsync(cacheFile, 'utf-8');
            const entry = JSON.parse(raw);
            if (!entry || typeof entry._accessedAt !== 'number') {
                return null;
            }
            return entry;
        }
        catch {
            return null;
        }
    }
    /**
     * 写入缓存条目
     * 原子写入: 临时文件 → rename
     * 写入后自动更新 manifest
     */
    async write(filePath, data) {
        await this.ensureDir();
        const cacheFile = this.cacheFilePath(filePath);
        const tmpFile = `${cacheFile}.tmp.${process.pid}`;
        const now = Date.now();
        // 读取已有条目（保留 _createdAt）
        let createdAt = now;
        if (!data._createdAt) {
            try {
                const existing = await this.read(filePath);
                if (existing)
                    createdAt = existing._createdAt;
            }
            catch {
                // 忽略读取错误
            }
        }
        const entry = {
            _accessedAt: data._accessedAt ?? now,
            _createdAt: createdAt,
            filePath: data.filePath,
            fileSizeBytes: data.fileSizeBytes ?? 0,
            lineCount: data.lineCount ?? 0,
            charCount: data.charCount ?? 0,
            head: data.head ?? '',
            description: data.description ?? '',
            keywords: data.keywords ?? [],
            sourceMtimeMs: data.sourceMtimeMs ?? 0,
            contentHash: data.contentHash ?? '',
        };
        const json = JSON.stringify(entry);
        await writeFileAsync(tmpFile, json, 'utf-8');
        await renameAsync(tmpFile, cacheFile);
        // 更新 manifest
        let sizeBytes = json.length;
        try {
            const st = await statAsync(cacheFile);
            sizeBytes = st.size;
        }
        catch {
            // 使用估算值
        }
        await upsertManifestEntry(this.cacheDir, {
            filePath: this.relativePath(filePath),
            cacheFile: `${hashFilePath(filePath)}.json`,
            accessedAt: entry._accessedAt,
            createdAt: entry._createdAt,
            sizeBytes,
            description: entry.description,
        });
    }
    /**
     * 触碰缓存条目（更新 _accessedAt）
     * 文件读取完成后调用，确保 LRU 时间戳正确
     */
    async touch(filePath) {
        const cacheFile = this.cacheFilePath(filePath);
        try {
            const raw = await readFileAsync(cacheFile, 'utf-8');
            const entry = JSON.parse(raw);
            if (!entry || typeof entry._accessedAt !== 'number')
                return;
            entry._accessedAt = Date.now();
            const tmpFile = `${cacheFile}.tmp.${process.pid}`;
            await writeFileAsync(tmpFile, JSON.stringify(entry), 'utf-8');
            await renameAsync(tmpFile, cacheFile);
            // 同时更新 manifest
            await upsertManifestEntry(this.cacheDir, {
                filePath: this.relativePath(filePath),
                cacheFile: `${hashFilePath(filePath)}.json`,
                accessedAt: entry._accessedAt,
                createdAt: entry._createdAt,
                sizeBytes: (await statAsync(cacheFile)).size,
                description: entry.description ?? '',
            });
        }
        catch {
            // 文件不存在时静默忽略
        }
    }
    /**
     * 删除单个缓存条目
     */
    async delete(filePath) {
        const cacheFile = this.cacheFilePath(filePath);
        try {
            await unlinkAsync(cacheFile);
        }
        catch {
            // 文件不存在
        }
        await removeManifestEntry(this.cacheDir, this.relativePath(filePath));
        return true;
    }
    /**
     * 清理过期条目（超过 maxAgeMs 未访问的）
     * @param maxAgeMs 过期时间，默认 5 天
     */
    async cleanStale(maxAgeMs = 5 * 24 * 60 * 60 * 1000) {
        const startTime = Date.now();
        const cutoff = Date.now() - maxAgeMs;
        let deleted = 0;
        let freedBytes = 0;
        // 从 manifest 读取所有条目（避免遍历目录）
        const manifest = await readManifest(this.cacheDir);
        const staleRelPaths = new Set();
        for (const entry of manifest.entries) {
            if (entry.accessedAt < cutoff) {
                staleRelPaths.add(entry.filePath);
            }
        }
        // 删除过期缓存文件
        for (const relPath of staleRelPaths) {
            const absPath = resolve(this.projectRoot, relPath);
            const cacheFile = this.cacheFilePath(absPath);
            try {
                const st = await statAsync(cacheFile);
                freedBytes += st.size;
                await unlinkAsync(cacheFile);
                deleted++;
            }
            catch {
                // 文件可能已被手动删除
            }
        }
        // 更新 manifest: 删除过期条目
        await removeManifestEntries(this.cacheDir, staleRelPaths);
        await updateCleanupTimestamp(this.cacheDir);
        return {
            deleted,
            freedBytes,
            durationMs: Date.now() - startTime,
        };
    }
    /**
     * 缓存统计
     */
    async stats() {
        const manifest = await readManifest(this.cacheDir);
        const now = Date.now();
        const staleCount = manifest.entries.filter(e => e.accessedAt < now - 5 * 24 * 60 * 60 * 1000).length;
        return {
            totalEntries: manifest.entries.length,
            totalSizeBytes: manifest.entries.reduce((sum, e) => sum + e.sizeBytes, 0),
            staleCount,
            cacheDir: this.cacheDir,
        };
    }
    /**
     * 构建缓存条目数据
     * 从源文件内容和元数据创建 DiskCacheEntry 的 partial 数据
     *
     * @param filePath 源文件绝对路径
     * @param content 源文件内容
     * @param sourceMtimeMs 源文件 mtime
     * @param lines 可选的行列表（用于提取 head）
     */
    buildEntryData(filePath, content, sourceMtimeMs, lines) {
        const allLines = lines ?? content.split('\n');
        const headLines = allLines.slice(0, this.headLines);
        let head = headLines.join('\n');
        // 强制截断 head 到 maxEntryBytes（防止超长行撑爆缓存）
        if (Buffer.byteLength(head, 'utf-8') > this.maxEntryBytes) {
            head = Buffer.from(head, 'utf-8').slice(0, this.maxEntryBytes).toString('utf-8');
        }
        // 从 head 中提取关键词（简单分词：中文 + 英文词）
        const keywords = this.extractKeywords(head);
        const charCount = content.length;
        // 提取文件功能描述
        const description = this.extractDescription(filePath, allLines);
        return {
            filePath: this.relativePath(filePath),
            lineCount: allLines.length,
            charCount,
            fileSizeBytes: Buffer.byteLength(content, 'utf-8'),
            head,
            description,
            keywords,
            sourceMtimeMs,
            contentHash: hashContent(content),
        };
    }
    /**
     * 从文件内容中提取功能描述（≤200 字符）
     *
     * 策略（按文件类型）：
     * - 代码文件：提取文件顶部的 JSDoc/块注释首句
     * - Markdown：提取第一个标题 + 紧随段落
     * - 文本：提取首段
     * - 回退：列出顶层导出符号作为结构摘要
     */
    extractDescription(filePath, lines) {
        const ext = extname(filePath).toLowerCase();
        const desc = this.extractCommentDescription(ext, lines);
        // 回退：结构摘要（也需经 truncateDesc 压缩）
        if (desc)
            return desc;
        const summary = this.extractStructuralSummary(ext, lines);
        return summary ? this.truncateDesc(summary) : '';
    }
    /** 代码文件扩展名集合 */
    static CODE_EXTENSIONS = new Set([
        '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
        '.py', '.rs', '.go', '.java', '.cs', '.cpp', '.c', '.h', '.hpp',
        '.swift', '.kt', '.rb', '.php', '.scala', '.dart', '.lua',
        '.sh', '.bash', '.zsh', '.ps1', '.psm1',
        '.sql', '.graphql', '.vue', '.svelte',
    ]);
    /**
     * 从注释/文档中提取描述
     */
    extractCommentDescription(ext, lines) {
        // Markdown: 第一个 # 标题 + 紧随段落
        if (ext === '.md' || ext === '.mdx') {
            return this.extractMarkdownDescription(lines);
        }
        // 代码文件：JSDoc/块注释
        if (DiskCache.CODE_EXTENSIONS.has(ext)) {
            const desc = this.extractBlockCommentDescription(lines);
            if (desc)
                return desc;
            // 回退到行注释
            return this.extractLineCommentDescription(lines);
        }
        // YAML / TOML / JSON: # 注释
        if (ext === '.yaml' || ext === '.yml' || ext === '.toml') {
            return this.extractLineCommentDescription(lines);
        }
        // 纯文本：首段
        return this.extractFirstParagraph(lines);
    }
    /**
     * 提取 JSDoc / 块注释中的描述
     */
    extractBlockCommentDescription(lines) {
        let inComment = false;
        const commentLines = [];
        for (const line of lines.slice(0, 30)) {
            const trimmed = line.trim();
            if (trimmed.startsWith('/**') || trimmed.startsWith('/*!')) {
                inComment = true;
                continue;
            }
            if (inComment) {
                if (trimmed.includes('*/')) {
                    const before = trimmed.slice(0, trimmed.indexOf('*/')).replace(/^\*\s?/, '').trim();
                    if (before)
                        commentLines.push(before);
                    break;
                }
                const content = trimmed.replace(/^\*\s?/, '').trim();
                if (content && !content.startsWith('@'))
                    commentLines.push(content);
            }
            if (!inComment && trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
                break; // 文件没有顶部块注释
            }
        }
        if (commentLines.length === 0)
            return '';
        return this.truncateDesc(commentLines.join(' '));
    }
    /**
     * 提取行注释 (// / #) 中的描述
     */
    extractLineCommentDescription(lines) {
        const commentLines = [];
        for (const line of lines.slice(0, 20)) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            // 跳过 shebang
            if (trimmed.startsWith('#!'))
                continue;
            if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
                const content = trimmed.replace(/^\/\/\s?/, '').replace(/^#\s?/, '').trim();
                if (content && !content.startsWith('@') && !content.startsWith('eslint') && !content.startsWith('ts-')) {
                    commentLines.push(content);
                }
            }
            else if (commentLines.length > 0) {
                break; // 注释块结束
            }
        }
        if (commentLines.length === 0)
            return '';
        return this.truncateDesc(commentLines.join(' '));
    }
    /**
     * 提取 Markdown 第一个标题 + 紧随段落
     */
    extractMarkdownDescription(lines) {
        let foundTitle = false;
        const parts = [];
        for (const line of lines.slice(0, 30)) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            if (trimmed.startsWith('#') && !foundTitle) {
                foundTitle = true;
                parts.push(trimmed.replace(/^#+\s*/, ''));
                continue;
            }
            if (foundTitle && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('```') && !trimmed.startsWith('- ') && !trimmed.startsWith('|')) {
                parts.push(trimmed);
                break;
            }
        }
        if (parts.length === 0)
            return '';
        return this.truncateDesc(parts.join(' — '));
    }
    /**
     * 提取纯文本首段（第一个空行前的内容）
     */
    extractFirstParagraph(lines) {
        const paraLines = [];
        for (const line of lines.slice(0, 15)) {
            const trimmed = line.trim();
            if (!trimmed) {
                if (paraLines.length > 0)
                    break;
                continue;
            }
            paraLines.push(trimmed);
        }
        if (paraLines.length === 0)
            return '';
        return this.truncateDesc(paraLines.join(' '));
    }
    /**
     * 结构摘要：列出顶层导出符号作为描述
     */
    extractStructuralSummary(ext, lines) {
        // TypeScript / JavaScript
        if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
            const exports = [];
            const functions = [];
            for (const line of lines.slice(0, 60)) {
                const m = line.match(/export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/);
                if (m)
                    exports.push(m[1]);
                else {
                    const fm = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
                    if (fm)
                        functions.push(fm[1]);
                }
            }
            if (exports.length > 0)
                return `Exports: ${exports.slice(0, 5).join(', ')}${exports.length > 5 ? '...' : ''}`;
            if (functions.length > 0)
                return `Functions: ${functions.slice(0, 5).join(', ')}`;
            return '';
        }
        // Python
        if (ext === '.py') {
            const defs = [];
            for (const line of lines.slice(0, 60)) {
                const m = line.match(/^(?:async\s+)?def\s+(\w+)|^class\s+(\w+)/);
                if (m)
                    defs.push(m[1] || m[2] || '');
            }
            if (defs.length > 0)
                return `Defines: ${defs.slice(0, 5).join(', ')}`;
            return '';
        }
        // Go
        if (ext === '.go') {
            const defs = [];
            for (const line of lines.slice(0, 60)) {
                const m = line.match(/^func\s+(?:\([^)]+\)\s+)?(\w+)|^type\s+(\w+)/);
                if (m)
                    defs.push(m[1] || m[2] || '');
            }
            if (defs.length > 0)
                return `Defines: ${defs.slice(0, 5).join(', ')}`;
            return '';
        }
        // Rust
        if (ext === '.rs') {
            const defs = [];
            for (const line of lines.slice(0, 60)) {
                const m = line.match(/^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)|^(?:pub\s+)?(?:struct|enum|trait|impl)\s+(\w+)/);
                if (m)
                    defs.push(m[1] || m[2] || '');
            }
            if (defs.length > 0)
                return `Defines: ${defs.slice(0, 5).join(', ')}`;
            return '';
        }
        return '';
    }
    /**
     * 清洗并截断描述到 ≤100 字符。
     *
     * 清洗步骤（先压缩再截断，保留更多语义）：
     * 1. 去掉标点符号（中英文）
     * 2. 去掉常见停用词（介词/冠词/助词）
     * 3. 每个词首字母大写 + 去掉空格（PascalCase 压缩）
     * 4. 在词边界截断
     *
     * 准确性：LLM 可解析 PascalCase；去掉停用词对理解无影响。
     * 保护：清洗后为空则回退到原始文本。
     */
    truncateDesc(text, max = 100) {
        const cleaned = this.stripNoiseAndStopwords(text);
        if (!cleaned) {
            const fallback = text.replace(/\s+/g, ' ').trim();
            if (fallback.length <= max)
                return fallback;
            const cut = fallback.lastIndexOf(' ', max);
            return (cut > max * 0.7 ? fallback.slice(0, cut) : fallback.slice(0, max)) + '…';
        }
        // 首字母大写 + 去空格（PascalCase）
        const pascal = cleaned
            .split(/\s+/)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join('');
        if (pascal.length <= max)
            return pascal;
        // PascalCase 已无空格，直接按字符截断
        return pascal.slice(0, max) + '…';
    }
    /** 去掉标点符号 + 停用词 + 压缩空白 */
    stripNoiseAndStopwords(text) {
        // 1. 去掉标点符号（中英文）
        let s = text.replace(/[.,;:!?()\[\]{}"'`'，。；：！？（）【】《》""'']/g, ' ');
        // 2. 去掉英文停用词（介词/冠词/连词/助动词）
        s = s.replace(/\b(the|a|an|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|shall|should|may|might|must|can|could|in|on|at|to|for|of|with|by|from|as|into|through|during|before|after|above|below|between|under|over|and|or|but|not|no|nor|so|if|than|that|this|these|those|it|its|they|them|their|we|us|our|he|she|his|her|also|very|just|then|now|here|there|when|where|which|who|whom|whose|how|all|each|every|both|few|more|most|other|some|such|only|own|same)\b/gi, ' ');
        // 3. 去掉中文停用词
        // 多字停用词（先匹配长的，避免部分匹配）
        s = s.replace(/重新|因为|所以|虽然|但是|然而|或者|并且|如果|由于|按照|通过|根据|关于|对于|以及|那么|这些|那些|什么|怎么|这样|那样|已经|以后|之前|之间|一个|这个|那个|可以/g, ' ');
        // 单字停用词（介词/助词/代词/连词/量词）
        s = s.replace(/[的了在是我有和就不人都一要会上也很大去能说对中下得着出而可自后没过把还里样小种向么现各此已其因所但或及被从将使与当给年]/g, ' ');
        // 4. 压缩多余空白
        return s.replace(/\s+/g, ' ').trim();
    }
    /**
     * 从文本中提取关键词
     * 简单策略: 提取 4-20 字符的中文短语 + 长度 >= 4 的英文词
     */
    extractKeywords(text) {
        const keywords = new Set();
        // 匹配中文短语（4-20 个中文字符）
        const chinesePattern = /[\u4e00-\u9fff]{4,20}/g;
        let match;
        while ((match = chinesePattern.exec(text)) !== null) {
            keywords.add(match[0]);
        }
        // 匹配英文词（长度 >= 4）
        const englishPattern = /\b[a-zA-Z]{4,}\b/g;
        while ((match = englishPattern.exec(text)) !== null) {
            keywords.add(match[0]);
        }
        return Array.from(keywords).slice(0, 50); // 最多 50 个关键词
    }
}
// ── Singleton ──
let _instance = null;
/**
 * 初始化 DiskCache 单例
 * @param projectRoot 项目根目录 (process.cwd() 或显式设置)
 */
export function initDiskCache(projectRoot) {
    _instance = new DiskCache({ projectRoot });
    return _instance;
}
/**
 * 获取 DiskCache 单例
 * 未初始化时返回 null（调用方应静默跳过）
 */
export function getDiskCache() {
    return _instance;
}
/**
 * 异步写入 DiskCache（fire-and-forget）
 * 用于工具回调中不需要 await 的场景
 */
export function writeDiskCacheAsync(filePath, content, mtimeMs, lines) {
    const dc = getDiskCache();
    if (!dc)
        return;
    // fire-and-forget: 不阻塞主流程
    dc.write(filePath, dc.buildEntryData(filePath, content, mtimeMs, lines)).catch(() => {
        // 静默忽略写入错误
    });
}
/**
 * 触碰 DiskCache（fire-and-forget）
 */
export function touchDiskCacheAsync(filePath) {
    const dc = getDiskCache();
    if (!dc)
        return;
    dc.touch(filePath).catch(() => { });
}
//# sourceMappingURL=disk-cache.js.map