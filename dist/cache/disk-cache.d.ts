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
import type { DiskCacheConfig, DiskCacheEntry, CleanStaleResult, DiskCacheStats } from './types.js';
/** 从文件内容计算哈希（SHA256 前 16 字符） */
export declare function hashContent(content: string): string;
export declare class DiskCache {
    private projectRoot;
    private cacheDir;
    private headLines;
    private maxEntryBytes;
    constructor(config: DiskCacheConfig);
    /** 获取 cache 目录路径 */
    getCacheDir(): string;
    /** 确保 cache 目录存在 */
    private ensureDir;
    /** 缓存文件路径（文件名 = 哈希） */
    private cacheFilePath;
    /** 将源文件路径转为相对于项目根的形式（用于缓存的 filePath 字段） */
    private relativePath;
    /**
     * 读取缓存条目
     * 返回 null 表示缓存缺失
     */
    read(filePath: string): Promise<DiskCacheEntry | null>;
    /**
     * 写入缓存条目
     * 原子写入: 临时文件 → rename
     * 写入后自动更新 manifest
     */
    write(filePath: string, data: Partial<DiskCacheEntry> & {
        filePath: string;
    }): Promise<void>;
    /**
     * 触碰缓存条目（更新 _accessedAt）
     * 文件读取完成后调用，确保 LRU 时间戳正确
     */
    touch(filePath: string): Promise<void>;
    /**
     * 删除单个缓存条目
     */
    delete(filePath: string): Promise<boolean>;
    /**
     * 清理过期条目（超过 maxAgeMs 未访问的）
     * @param maxAgeMs 过期时间，默认 5 天
     */
    cleanStale(maxAgeMs?: number): Promise<CleanStaleResult>;
    /**
     * 缓存统计
     */
    stats(): Promise<DiskCacheStats>;
    /**
     * 构建缓存条目数据
     * 从源文件内容和元数据创建 DiskCacheEntry 的 partial 数据
     *
     * @param filePath 源文件绝对路径
     * @param content 源文件内容
     * @param sourceMtimeMs 源文件 mtime
     * @param lines 可选的行列表（用于提取 head）
     */
    buildEntryData(filePath: string, content: string, sourceMtimeMs: number, lines?: string[]): Partial<DiskCacheEntry> & {
        filePath: string;
    };
    /**
     * 从文件内容中提取功能描述（≤200 字符）
     *
     * 策略（按文件类型）：
     * - 代码文件：提取文件顶部的 JSDoc/块注释首句
     * - Markdown：提取第一个标题 + 紧随段落
     * - 文本：提取首段
     * - 回退：列出顶层导出符号作为结构摘要
     */
    private extractDescription;
    /** 代码文件扩展名集合 */
    private static readonly CODE_EXTENSIONS;
    /**
     * 从注释/文档中提取描述
     */
    private extractCommentDescription;
    /**
     * 提取 JSDoc / 块注释中的描述
     */
    private extractBlockCommentDescription;
    /**
     * 提取行注释 (// / #) 中的描述
     */
    private extractLineCommentDescription;
    /**
     * 提取 Markdown 第一个标题 + 紧随段落
     */
    private extractMarkdownDescription;
    /**
     * 提取纯文本首段（第一个空行前的内容）
     */
    private extractFirstParagraph;
    /**
     * 结构摘要：列出顶层导出符号作为描述
     */
    private extractStructuralSummary;
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
    private truncateDesc;
    /** 去掉标点符号 + 停用词 + 压缩空白 */
    private stripNoiseAndStopwords;
    /**
     * 从文本中提取关键词
     * 简单策略: 提取 4-20 字符的中文短语 + 长度 >= 4 的英文词
     */
    private extractKeywords;
}
/**
 * 初始化 DiskCache 单例
 * @param projectRoot 项目根目录 (process.cwd() 或显式设置)
 */
export declare function initDiskCache(projectRoot: string): DiskCache;
/**
 * 获取 DiskCache 单例
 * 未初始化时返回 null（调用方应静默跳过）
 */
export declare function getDiskCache(): DiskCache | null;
/**
 * 异步写入 DiskCache（fire-and-forget）
 * 用于工具回调中不需要 await 的场景
 */
export declare function writeDiskCacheAsync(filePath: string, content: string, mtimeMs: number, lines?: string[]): void;
/**
 * 触碰 DiskCache（fire-and-forget）
 */
export declare function touchDiskCacheAsync(filePath: string): void;
//# sourceMappingURL=disk-cache.d.ts.map