/**
 * 语义上下文设置 API
 *
 * GET  /api/settings/semantic-context → 读取当前配置
 * POST /api/settings/semantic-context → 更新配置（body: Partial<SemanticContextConfig>）
 *
 * Step 8 / 18 执行步骤
 */
import { loadSettings, saveSettings } from '../../chat/settings.js';
/** 读取请求 body（限制 64KB 防止 OOM） */
function readBody(req, maxBytes = 65536) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        req.on('data', (chunk) => {
            total += chunk.length;
            if (total > maxBytes) {
                req.destroy();
                reject(new Error('Request body too large'));
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        req.on('error', reject);
    });
}
export async function handleSemanticSettings(req, res, method) {
    try {
        if (method === 'GET') {
            const settings = loadSettings();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(settings.semanticContext));
            return;
        }
        if (method === 'POST') {
            const body = await readBody(req);
            const partial = JSON.parse(body);
            // 🔧 Bug Fix: 输入验证 + 白名单枚举
            if (partial.embeddingModel) {
                const VALID_TYPES = new Set(['local-bge-m3', 'online']);
                const VALID_MODEL_IDS = new Set([
                    'bge-m3', 'text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002',
                ]);
                if (partial.embeddingModel.type && !VALID_TYPES.has(partial.embeddingModel.type)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: `Invalid embeddingModel.type: ${partial.embeddingModel.type}` }));
                    return;
                }
                if (partial.embeddingModel.modelId && !VALID_MODEL_IDS.has(partial.embeddingModel.modelId)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: `Invalid embeddingModel.modelId: ${partial.embeddingModel.modelId}` }));
                    return;
                }
            }
            if (partial.contextMessageLimit !== undefined) {
                partial.contextMessageLimit = Math.max(5, Math.min(100, partial.contextMessageLimit));
            }
            if (partial.similarityThreshold !== undefined) {
                partial.similarityThreshold = Math.max(0.1, Math.min(0.95, partial.similarityThreshold));
            }
            if (partial.routingThreshold !== undefined) {
                partial.routingThreshold = Math.max(0.2, Math.min(0.95, partial.routingThreshold));
            }
            // 深度合并：允许部分更新
            const current = loadSettings();
            const merged = deepMerge(current.semanticContext, partial);
            saveSettings({ semanticContext: merged });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, semanticContext: merged }));
            return;
        }
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
    catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
    }
}
function deepMerge(base, partial) {
    return {
        enabled: partial.enabled ?? base.enabled,
        embeddingModel: {
            type: partial.embeddingModel?.type ?? base.embeddingModel.type,
            modelId: partial.embeddingModel?.modelId ?? base.embeddingModel.modelId,
        },
        contextMessageLimit: partial.contextMessageLimit ?? base.contextMessageLimit,
        similarityThreshold: partial.similarityThreshold ?? base.similarityThreshold,
        routingThreshold: partial.routingThreshold ?? base.routingThreshold,
        features: {
            semanticFilter: partial.features?.semanticFilter ?? base.features.semanticFilter,
            agentRouting: partial.features?.agentRouting ?? base.features.agentRouting,
            codeRAG: partial.features?.codeRAG ?? base.features.codeRAG,
            exampleInjection: partial.features?.exampleInjection ?? base.features.exampleInjection,
            docAssociation: partial.features?.docAssociation ?? base.features.docAssociation,
            toolDedup: partial.features?.toolDedup ?? base.features.toolDedup,
        },
    };
}
//# sourceMappingURL=semantic-settings.js.map