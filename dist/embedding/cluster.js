/**
 * 对话聚类 + 主题记忆 — 层次聚类 + 主题提取 + MEMORY.md 分区更新
 *
 * 按主题聚类历史会话，MEMORY.md 从零散条目升级为按主题组织。
 *
 * 🔧 R2-1: 分区标记（CLUSTER_AUTO_START/END），只替换标记之间内容。
 *
 * Step 15 / 18 执行步骤
 */
import { join, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { getSharedDb } from './db.js';
import { SESSION_CLUSTERS_DDL } from './schema.js';
import { getEmbeddingProvider, isSemanticEnabled } from './provider.js';
import { cosineSimilarity, serializeEmbedding, deserializeEmbedding } from './store.js';
const MIN_CLUSTER_SESSIONS = 3; // 每个 cluster 至少 3 个会话
const MEMORY_MARKER_START = '<!-- ═════ CLUSTER_AUTO_START ═════ -->';
const MEMORY_MARKER_END = '<!-- ═════ CLUSTER_AUTO_END ═════ -->';
function memoryPath() {
    // MEMORY.md 位于 .codebuddy/memory/ 目录（CodeBuddy 规范）
    const root = process.env.CODESQUAD_HOME
        ? join(process.env.CODESQUAD_HOME, '..')
        : process.env.USERPROFILE || process.env.HOME || '';
    return join(root, '.codebuddy', 'memory', 'MEMORY.md');
}
export class SessionClusterer {
    db;
    constructor(dbPathOverride) {
        this.db = getSharedDb(dbPathOverride);
        this.init();
    }
    init() {
        this.db.exec(SESSION_CLUSTERS_DDL);
    }
    /**
     * 执行层次聚类：
     * 1. 从 VectorStore 加载所有 session 的 centroid embedding
     * 2. 层次聚类（agglomerative）
     * 3. 对每个 cluster 提取主题
     * 4. 更新 MEMORY.md
     */
    async cluster(getSessionCentroid, listSessions) {
        if (!isSemanticEnabled())
            return [];
        const provider = await getEmbeddingProvider();
        if (!provider)
            return [];
        const sessionIds = listSessions()
            .filter(id => !id.startsWith('fork-'));
        if (sessionIds.length < MIN_CLUSTER_SESSIONS)
            return [];
        // 1) 加载所有 session 的 centroid
        const centroids = [];
        for (const sid of sessionIds) {
            const emb = await getSessionCentroid(sid);
            if (emb) {
                centroids.push({ id: sid, emb });
            }
        }
        if (centroids.length < MIN_CLUSTER_SESSIONS)
            return [];
        // 2) 简单层次聚类（single-linkage）
        const clusters = agglomerativeCluster(centroids, 0.6);
        // 3) 提取主题
        const result = [];
        for (const cluster of clusters) {
            if (cluster.sessions.length < MIN_CLUSTER_SESSIONS)
                continue;
            const topic = await extractTopic(cluster, provider);
            const knowledgeItems = extractKnowledgeItems(cluster);
            const id = `cluster:${topic.toLowerCase().replace(/\s+/g, '-').slice(0, 40)}`;
            // 持久化
            this.db.prepare(/* sql */ `
        INSERT OR REPLACE INTO session_clusters
          (id, topic, session_ids, centroid_embedding, knowledge_items, updated_at)
        VALUES
          (@id, @topic, @sessionIds, @centroid, @knowledgeItems, datetime('now'))
      `).run({
                id,
                topic,
                sessionIds: JSON.stringify(cluster.sessions.map(s => s.id)),
                centroid: serializeEmbedding(cluster.centroid),
                knowledgeItems: JSON.stringify(knowledgeItems),
            });
            result.push({
                id,
                topic,
                sessionIds: cluster.sessions.map(s => s.id),
                centroidEmbedding: cluster.centroid,
                knowledgeItems,
            });
        }
        // 4) 🔧 R2-1: 更新 MEMORY.md（分区标记）
        if (result.length > 0) {
            await this.updateMemoryFile(result);
        }
        return result;
    }
    /**
     * 🔧 R2-1: 更新 MEMORY.md，只替换标记之间内容。
     */
    async updateMemoryFile(clusters) {
        const path = memoryPath();
        let content;
        try {
            content = readFileSync(path, 'utf-8');
        }
        catch {
            // 文件不存在，创建新文件
            content = `# Project Memory\n\n${MEMORY_MARKER_START}\n${MEMORY_MARKER_END}\n`;
        }
        // 构建聚类内容
        const clusterContent = clusters.map(c => {
            const items = c.knowledgeItems.map(i => `- ${i}`).join('\n');
            return `### ${c.topic}\n${items}`;
        }).join('\n\n');
        const autoSection = `${MEMORY_MARKER_START}\n## 自动聚类记忆\n\n${clusterContent}\n${MEMORY_MARKER_END}`;
        // 如果已有标记，替换标记之间内容
        const startIdx = content.indexOf(MEMORY_MARKER_START);
        const endIdx = content.indexOf(MEMORY_MARKER_END);
        if (startIdx !== -1 && endIdx !== -1) {
            content = content.slice(0, startIdx) + autoSection + content.slice(endIdx + MEMORY_MARKER_END.length);
        }
        else {
            // 没有标记，追加到末尾
            content += '\n\n' + autoSection;
        }
        // 确保目录存在
        const dir = dirname(path);
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
        writeFileSync(path, content, 'utf-8');
    }
    getClusters() {
        const rows = this.db.prepare(/* sql */ `
      SELECT id, topic, session_ids, centroid_embedding, knowledge_items
      FROM session_clusters
      ORDER BY updated_at DESC
    `).all();
        return rows.map(r => ({
            id: r.id,
            topic: r.topic,
            sessionIds: JSON.parse(r.session_ids),
            centroidEmbedding: deserializeEmbedding(r.centroid_embedding),
            knowledgeItems: JSON.parse(r.knowledge_items),
        }));
    }
    close() {
        // 共享连接不在此关闭
    }
}
function agglomerativeCluster(centroids, threshold) {
    // 初始：每个 session 是一个 cluster
    const nodes = centroids.map(c => ({
        sessions: [c],
        centroid: c.emb,
    }));
    if (nodes.length <= 1)
        return nodes;
    // 迭代合并
    let merged = true;
    while (merged && nodes.length > 1) {
        merged = false;
        let bestI = -1;
        let bestJ = -1;
        let bestSim = -1;
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const sim = cosineSimilarity(nodes[i].centroid, nodes[j].centroid);
                if (sim > bestSim && sim >= threshold) {
                    bestSim = sim;
                    bestI = i;
                    bestJ = j;
                }
            }
        }
        if (bestI !== -1 && bestJ !== -1) {
            // 合并 bestJ 到 bestI
            const nodeI = nodes[bestI];
            const nodeJ = nodes[bestJ];
            nodeI.sessions.push(...nodeJ.sessions);
            // 更新 centroid（平均）
            const dims = nodeI.centroid.length;
            const newCentroid = new Float32Array(dims);
            const sessions = nodeI.sessions;
            for (const s of sessions) {
                const emb = s.emb;
                for (let d = 0; d < dims; d++) {
                    newCentroid[d] = (newCentroid[d] ?? 0) + (emb[d] ?? 0);
                }
            }
            const count = sessions.length;
            for (let d = 0; d < dims; d++) {
                newCentroid[d] = (newCentroid[d] ?? 0) / count;
            }
            nodeI.centroid = newCentroid;
            nodes.splice(bestJ, 1);
            merged = true;
        }
    }
    return nodes;
}
// ── 主题提取 ──
async function extractTopic(cluster, provider) {
    // 简单实现：使用知识项中出现频率最高的词
    const items = extractKnowledgeItems(cluster);
    if (items.length > 0) {
        // 取第一个知识项的前 50 字符作为主题
        return items[0].slice(0, 50);
    }
    return `Cluster ${cluster.sessions.length} sessions`;
}
// ── 知识提取 ──
function extractKnowledgeItems(cluster) {
    // 从 session ID 中提取关键词
    const items = [];
    const sessionIds = cluster.sessions.map(s => s.id);
    items.push(`Clustered ${sessionIds.length} sessions: ${sessionIds.slice(0, 5).join(', ')}`);
    return items;
}
// ── 全局单例 ──
let clustererInstance = null;
export function getSessionClusterer() {
    if (!clustererInstance) {
        clustererInstance = new SessionClusterer();
    }
    return clustererInstance;
}
export function resetSessionClusterer() {
    clustererInstance = null;
}
//# sourceMappingURL=cluster.js.map