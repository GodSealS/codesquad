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
import { existsSync } from 'fs';
import { getModelStatus, downloadModel, qwenModelPath, getQwenModelStatus, downloadQwenModel, } from '../../embedding/downloader.js';
// ── SSE 进度流下载 bge-m3 ──
export async function handleDownloadEmbedding(_req, res) {
    // SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // 禁用 nginx 缓冲
    });
    let closed = false;
    _req.on('close', () => { closed = true; });
    const sendEvent = (event, data) => {
        if (closed || res.writableEnded || res.destroyed)
            return;
        try {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        }
        catch {
            closed = true;
        }
    };
    try {
        await downloadModel((progress) => {
            sendEvent('progress', progress);
            if (progress.status === 'error') {
                sendEvent('error', { message: progress.error });
            }
            else if (progress.status === 'completed') {
                sendEvent('done', { path: getModelStatus().path });
            }
        });
        sendEvent('done', { path: getModelStatus().path });
    }
    catch (e) {
        sendEvent('error', { message: e.message });
    }
    finally {
        res.end();
    }
}
// ── SSE 进度流下载 Qwen Summarizer 模型 ──
export async function handleDownloadQwen(_req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    let closed = false;
    _req.on('close', () => { closed = true; });
    const sendEvent = (event, data) => {
        if (closed || res.writableEnded || res.destroyed)
            return;
        try {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        }
        catch {
            closed = true;
        }
    };
    try {
        await downloadQwenModel((progress) => {
            sendEvent('progress', progress);
            if (progress.status === 'error') {
                sendEvent('error', { message: progress.error });
            }
            else if (progress.status === 'completed') {
                sendEvent('done', { path: getQwenModelStatus().path });
            }
        });
        sendEvent('done', { path: getQwenModelStatus().path });
    }
    catch (e) {
        sendEvent('error', { message: e.message });
    }
    finally {
        res.end();
    }
}
// ── 下载状态（含 Qwen 摘要模型检测）──
/** 检测 Qwen Summarizer 模型：基于 GGUF 文件存在性（node-llama-cpp） */
function checkQwenModel() {
    const liteMode = process.env.CODESQUAD_LITE === '1';
    const model = liteMode ? 'Qwen2.5-1.5B-Instruct' : 'Qwen2.5-3B-Instruct';
    const exists = existsSync(qwenModelPath());
    return { available: exists, model, liteMode };
}
export async function handleEmbeddingStatus(_req, res) {
    try {
        const bgeStatus = getModelStatus();
        const qwenStatus = checkQwenModel();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            bge: bgeStatus,
            qwen: qwenStatus,
        }));
    }
    catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
    }
}
export async function handleEmbeddingCapable(_req, res) {
    try {
        const models = [
            {
                sourceKey: 'bge-m3',
                displayName: 'BGE-M3 (Local)',
                dimensions: 1024,
                supported: true,
            },
            {
                sourceKey: 'text-embedding-3-small',
                displayName: 'OpenAI text-embedding-3-small',
                dimensions: 1536,
                supported: true,
            },
            {
                sourceKey: 'text-embedding-3-large',
                displayName: 'OpenAI text-embedding-3-large',
                dimensions: 3072,
                supported: true,
            },
            {
                sourceKey: 'text-embedding-ada-002',
                displayName: 'OpenAI text-embedding-ada-002',
                dimensions: 1536,
                supported: true,
            },
        ];
        // 过滤不支持 embedding 的模型（当前所有模型都支持，预留给未来扩展）
        const capable = models.filter(m => m.supported);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(capable));
    }
    catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
    }
}
//# sourceMappingURL=embedding-models.js.map