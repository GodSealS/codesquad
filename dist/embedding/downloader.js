/**
 * 模型下载器 — 断点续传 + 进度回调 + SHA256 校验
 *
 * 从 GitHub Release / HuggingFace / Modelscope 镜像下载 bge-m3 / Qwen2.5 GGUF 到 ~/.codesquad/models/。
 * 支持 HTTP Range header 断点续传。
 *
 * Step 3 / 18 执行步骤
 */
import { createWriteStream, existsSync, statSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { codesquadHome } from '../chat/storage.js';
// ── 常量 ──
const BGE_M3_MODEL_NAME = 'bge-m3';
const BGE_M3_FILENAME = 'bge-m3-Q4_K_M.gguf';
// 按优先级排列的 GGUF 文件名（都试一遍，第一个能下载的就用）
const BGE_M3_FILENAME_VARIANTS = [
    'bge-m3-Q4_K_M.gguf', // 推荐：4-bit 中等量化 (~1.2GB)
    'bge-m3-Q4_0.gguf', // 备选：4-bit 基础量化
    'bge-m3-Q5_K_M.gguf', // 5-bit 中等量化
    'bge-m3-f16.gguf', // 全精度（文件较大）
];
/** 构建 URL 列表：Modelscope > 加速代理 > HuggingFace > 镜像 > GitHub（兜底） */
function buildBgeM3Urls() {
    // 环境变量覆盖（最高优先级）
    const envUrl = process.env.CODESQUAD_BGE_M3_URL;
    if (envUrl)
        return [envUrl];
    const urls = [];
    // ── Modelscope（国内首选）──
    urls.push('https://modelscope.cn/models/Xorbits/bge-m3-gguf/resolve/master/bge-m3-Q4_K_M.gguf');
    // Modelscope 其他路径 × 变体
    const modelscopeBases = [
        'https://modelscope.cn/models/BAAI/bge-m3/resolve/master',
        'https://www.modelscope.cn/models/BAAI/bge-m3/resolve/master',
    ];
    for (const base of modelscopeBases) {
        for (const filename of BGE_M3_FILENAME_VARIANTS) {
            urls.push(`${base}/${filename}`);
        }
    }
    // ── GitHub 加速代理（国内提速）──
    const GITHUB_BGE_URL = 'https://github.com/GodSealS/codesquad/releases/download/GameAgentModel/bge-m3-Q4_K_M.gguf';
    for (const proxy of ['ghfast.top', 'gh.con.sh', 'ghp.ci']) {
        urls.push(`https://${proxy}/${GITHUB_BGE_URL}`);
    }
    // ── HuggingFace 官方 ──
    const hfRepos = [
        'bartowski/bge-m3-GGUF',
        'ChristianAzinn/bge-m3-gguf',
        'Xorbits/bge-m3-GGUF',
    ];
    for (const repo of hfRepos) {
        for (const filename of BGE_M3_FILENAME_VARIANTS) {
            urls.push(`https://huggingface.co/${repo}/resolve/main/${filename}`);
        }
    }
    // ── 镜像 × 文件名变体 ──
    const mirrorBases = [
        'https://hf-mirror.com/bartowski/bge-m3-GGUF/resolve/main',
        'https://cdn-lfs-us-1.huggingface.co/bartowski/bge-m3-GGUF/main',
        'https://cdn-lfs-eu-1.huggingface.co/bartowski/bge-m3-GGUF/main',
    ];
    for (const base of mirrorBases) {
        for (const filename of BGE_M3_FILENAME_VARIANTS) {
            urls.push(`${base}/${filename}`);
        }
    }
    // ── GitHub 直连（兜底）──
    urls.push(GITHUB_BGE_URL);
    return urls;
}
// SHA256 在下载时从 HuggingFace API 动态获取，或下载后本地计算校验
let _cachedSHA256 = null;
// ── Qwen Summarizer 模型常量 ──
const QWEN_MODEL_NAME = 'qwen2.5';
const QWEN_FILENAME = 'qwen2.5-3b-instruct-Q4_K_M.gguf';
const QWEN_DOWNLOAD_URL = 'https://github.com/GodSealS/codesquad/releases/download/GameAgentModel/qwen2.5-3b-instruct-Q4_K_M.gguf';
// 轻量模式
const QWEN_LITE_FILENAME = 'qwen2.5-1.5b-instruct-Q4_K_M.gguf';
const QWEN_LITE_DOWNLOAD_URL = 'https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf';
const QWEN_MIRROR_URLS = [
    // ── GitHub 加速代理 ──
    ...['ghfast.top', 'gh.con.sh', 'ghp.ci'].map(p => `https://${p}/${QWEN_DOWNLOAD_URL}`),
    // ── HuggingFace 镜像 ──
    'https://hf-mirror.com/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    'https://cdn-lfs-us-1.huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    'https://cdn-lfs-eu-1.huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    'https://hf.zhangkai.xin/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    // ── GitHub 直连（兜底）──
    QWEN_DOWNLOAD_URL,
];
const QWEN_LITE_MIRROR_URLS = [
    QWEN_LITE_DOWNLOAD_URL,
    'https://hf-mirror.com/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    'https://cdn-lfs-us-1.huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    'https://cdn-lfs-eu-1.huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    'https://hf.zhangkai.xin/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
];
// ── 路径 ──
export function modelDir() {
    const dir = join(codesquadHome(), 'models', BGE_M3_MODEL_NAME);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    return dir;
}
export function modelPath() {
    // 环境变量覆盖：直接指定本地模型文件路径
    if (process.env.CODESQUAD_BGE_M3_PATH) {
        return process.env.CODESQUAD_BGE_M3_PATH;
    }
    return join(modelDir(), BGE_M3_FILENAME);
}
// ── Qwen 路径 ──
export function qwenModelDir() {
    const dir = join(codesquadHome(), 'models', QWEN_MODEL_NAME);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    return dir;
}
export function qwenModelPath() {
    const liteMode = process.env.CODESQUAD_LITE === '1';
    const filename = liteMode ? QWEN_LITE_FILENAME : QWEN_FILENAME;
    return join(qwenModelDir(), filename);
}
export function getModelStatus() {
    const path = modelPath();
    const exists = existsSync(path);
    return {
        downloaded: exists,
        size: exists ? statSync(path).size : 0,
        path,
        verified: false, // 由 verifyModel 单独设置
    };
}
// ── 下载 ──
export async function downloadModel(onProgress) {
    const targetPath = modelPath();
    const targetDir = modelDir();
    // 确保目录存在
    if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
    }
    // 获取已下载大小（断点续传）
    let downloadedBytes = 0;
    if (existsSync(targetPath)) {
        downloadedBytes = statSync(targetPath).size;
    }
    // 构建下载 URL 列表（环境变量 > 官方 × 变体 > 镜像 × 变体）
    const urls = buildBgeM3Urls();
    for (const url of urls) {
        try {
            await downloadFromUrl(url, targetPath, downloadedBytes, onProgress);
            return; // 成功
        }
        catch (e) {
            console.warn(`[Downloader] failed from ${url}: ${e.message}`);
            // 继续尝试下一个镜像
        }
    }
    throw new Error('[Downloader] all download sources failed');
}
async function downloadFromUrl(url, targetPath, resumeFrom, onProgress) {
    // ── 获取文件大小（HEAD 不可用时降级为无进度条下载）──
    let totalSize = 0;
    try {
        const headResponse = await fetch(url, { method: 'HEAD' });
        totalSize = parseInt(headResponse.headers.get('Content-Length') ?? '0', 10);
        // HEAD 返回 200+Content-Length=0 → 尝试 GET Range:bytes=0-0 获取 Content-Length
        if (totalSize === 0 && headResponse.ok) {
            const rangeResp = await fetch(url, { headers: { 'Range': 'bytes=0-0' } });
            totalSize = parseInt(rangeResp.headers.get('Content-Range')?.split('/')[1] ?? '0', 10);
            if (totalSize === 0) {
                totalSize = parseInt(rangeResp.headers.get('Content-Length') ?? '0', 10);
            }
        }
    }
    catch {
        // HEAD 不可用 → 无大小提示，直接流式下载
    }
    // 如果已完整下载，跳过
    if (totalSize > 0 && resumeFrom >= totalSize) {
        onProgress?.({
            downloaded: totalSize,
            total: totalSize,
            percent: 100,
            speed: 0,
            status: 'completed',
        });
        return;
    }
    // 发送 Range 请求
    const headers = {};
    if (resumeFrom > 0) {
        headers['Range'] = `bytes=${resumeFrom}-`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP ${response.status} from ${url}`);
    }
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('No response body');
    }
    // 以追加模式打开文件
    const writeStream = createWriteStream(targetPath, {
        flags: resumeFrom > 0 ? 'a' : 'w',
    });
    let downloaded = resumeFrom;
    let lastTimestamp = Date.now();
    let lastDownloaded = downloaded;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            writeStream.write(Buffer.from(value));
            downloaded += value.length;
            // 节流进度回调（每 100ms 报告一次）
            const now = Date.now();
            if (onProgress && now - lastTimestamp >= 100) {
                const speed = ((downloaded - lastDownloaded) / (now - lastTimestamp)) * 1000;
                onProgress({
                    downloaded,
                    total: totalSize || downloaded, // unknown size → show current
                    percent: totalSize > 0 ? Math.min(99.9, (downloaded / totalSize) * 100) : 0,
                    speed,
                    status: 'downloading',
                });
                lastTimestamp = now;
                lastDownloaded = downloaded;
            }
        }
    }
    finally {
        // 🔧 Fix Bug 5: 等待 finish 事件确保文件完全写入磁盘
        const finishPromise = new Promise(resolve => {
            writeStream.on('finish', () => resolve());
            writeStream.on('error', () => resolve()); // 出错也 resolve，避免永久阻塞
        });
        writeStream.end();
        await finishPromise;
    }
    // 下载完成
    onProgress?.({
        downloaded: totalSize,
        total: totalSize,
        percent: 100,
        speed: 0,
        status: 'verifying',
    });
}
// ── SHA256 校验 ──
/**
 * 尝试从 HuggingFace API 获取文件的预期 SHA256。
 * 如果获取失败，返回 null（跳过在线校验，仅本地计算）。
 */
async function fetchExpectedSHA256() {
    if (_cachedSHA256)
        return _cachedSHA256;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch('https://huggingface.co/api/models/bartowski/bge-m3-GGUF', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok)
            return null;
        const data = (await response.json());
        const file = data?.siblings?.find(s => s.rfilename === BGE_M3_FILENAME);
        const sha256 = file?.sha256 ?? file?.lfs?.sha256;
        if (sha256) {
            _cachedSHA256 = sha256;
            console.log(`[Downloader] fetched expected SHA256: ${sha256}`);
            return sha256;
        }
    }
    catch {
        // HuggingFace API 不可达，跳过在线校验
    }
    return null;
}
export async function verifyModel() {
    const path = modelPath();
    if (!existsSync(path))
        return false;
    const hash = createHash('sha256');
    const data = readFileSync(path);
    hash.update(data);
    const computed = hash.digest('hex');
    console.log(`[Downloader] computed SHA256: ${computed}`);
    // 尝试获取预期 SHA256 进行比对
    const expected = await fetchExpectedSHA256();
    if (!expected) {
        // 无法获取预期值，输出计算值供用户手动验证
        console.warn(`[Downloader] 无法获取预期 SHA256，跳过在线校验。\n` +
            `  计算值: ${computed}\n` +
            `  请手动验证: https://huggingface.co/bartowski/bge-m3-GGUF`);
        return true; // 无法校验时假定通过（不阻塞）
    }
    const valid = computed.toLowerCase() === expected.toLowerCase();
    if (!valid) {
        console.warn(`[Downloader] SHA256 mismatch!\n  Expected: ${expected}\n  Got:      ${computed}`);
    }
    return valid;
}
// ── 便捷方法 ──
/** 确保模型已下载并校验。 */
export async function ensureModel() {
    const status = getModelStatus();
    if (status.downloaded) {
        // 校验已有文件
        const valid = await verifyModel();
        if (valid)
            return true;
        // 校验失败，重新下载
        console.warn('[Downloader] model verification failed, re-downloading');
    }
    // 下载模型
    await downloadModel();
    // 校验下载结果
    return verifyModel();
}
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Qwen Summarizer 模型
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/** 获取 Qwen 模型状态 */
export function getQwenModelStatus() {
    const path = qwenModelPath();
    const exists = existsSync(path);
    return {
        downloaded: exists,
        size: exists ? statSync(path).size : 0,
        path,
        verified: false,
    };
}
/** 下载 Qwen Summarizer 模型（断点续传 + SSE 进度） */
export async function downloadQwenModel(onProgress) {
    const targetPath = qwenModelPath();
    const targetDir = qwenModelDir();
    if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
    }
    let downloadedBytes = 0;
    if (existsSync(targetPath)) {
        downloadedBytes = statSync(targetPath).size;
    }
    const liteMode = process.env.CODESQUAD_LITE === '1';
    const urls = liteMode ? QWEN_LITE_MIRROR_URLS : QWEN_MIRROR_URLS;
    for (const url of urls) {
        try {
            await downloadFromUrl(url, targetPath, downloadedBytes, onProgress);
            return;
        }
        catch (e) {
            console.warn(`[Downloader] Qwen failed from ${url}: ${e.message}`);
        }
    }
    throw new Error('[Downloader] all Qwen download sources failed');
}
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Qwen SHA256 校验
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let _cachedQwenSHA256 = null;
async function fetchQwenExpectedSHA256() {
    if (_cachedQwenSHA256)
        return _cachedQwenSHA256;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const liteMode = process.env.CODESQUAD_LITE === '1';
        const repoName = liteMode
            ? 'bartowski/Qwen2.5-1.5B-Instruct-GGUF'
            : 'bartowski/Qwen2.5-3B-Instruct-GGUF';
        const response = await fetch(`https://huggingface.co/api/models/${repoName}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok)
            return null;
        const data = (await response.json());
        const filename = liteMode ? QWEN_LITE_FILENAME : QWEN_FILENAME;
        const file = data?.siblings?.find(s => s.rfilename === filename);
        const sha256 = file?.sha256 ?? file?.lfs?.sha256;
        if (sha256) {
            _cachedQwenSHA256 = sha256;
            console.log(`[Downloader] fetched expected Qwen SHA256: ${sha256}`);
            return sha256;
        }
    }
    catch {
        // HuggingFace API 不可达，跳过在线校验
    }
    return null;
}
/** 🔧 Fix Bug 4: 验证 Qwen 模型 SHA256 完整性 */
export async function verifyQwenModel() {
    const path = qwenModelPath();
    if (!existsSync(path))
        return false;
    const hash = createHash('sha256');
    const data = readFileSync(path);
    hash.update(data);
    const computed = hash.digest('hex');
    console.log(`[Downloader] computed Qwen SHA256: ${computed}`);
    const expected = await fetchQwenExpectedSHA256();
    if (!expected) {
        console.warn(`[Downloader] 无法获取预期 Qwen SHA256，跳过在线校验。\n` +
            `  计算值: ${computed}`);
        return true; // 无法校验时假定通过
    }
    const valid = computed.toLowerCase() === expected.toLowerCase();
    if (!valid) {
        console.warn(`[Downloader] Qwen SHA256 mismatch!\n  Expected: ${expected}\n  Got:      ${computed}`);
    }
    return valid;
}
//# sourceMappingURL=downloader.js.map