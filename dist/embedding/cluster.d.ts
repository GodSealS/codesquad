/**
 * 对话聚类 + 主题记忆 — 层次聚类 + 主题提取 + MEMORY.md 分区更新
 *
 * 按主题聚类历史会话，MEMORY.md 从零散条目升级为按主题组织。
 *
 * 🔧 R2-1: 分区标记（CLUSTER_AUTO_START/END），只替换标记之间内容。
 *
 * Step 15 / 18 执行步骤
 */
import type { SessionCluster } from './types.js';
export declare class SessionClusterer {
    private db;
    constructor(dbPathOverride?: string);
    private init;
    /**
     * 执行层次聚类：
     * 1. 从 VectorStore 加载所有 session 的 centroid embedding
     * 2. 层次聚类（agglomerative）
     * 3. 对每个 cluster 提取主题
     * 4. 更新 MEMORY.md
     */
    cluster(getSessionCentroid: (sessionId: string) => Promise<Float32Array | null>, listSessions: () => string[]): Promise<SessionCluster[]>;
    /**
     * 🔧 R2-1: 更新 MEMORY.md，只替换标记之间内容。
     */
    private updateMemoryFile;
    getClusters(): SessionCluster[];
    close(): void;
}
export declare function getSessionClusterer(): SessionClusterer;
export declare function resetSessionClusterer(): void;
//# sourceMappingURL=cluster.d.ts.map