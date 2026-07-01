/**
 * 共享 SQLite 数据库连接管理
 *
 * 🔧 Bug Fix: 所有 embedding 模块（VectorStore/CodeRAG/ToolDedup/ExampleStore/
 * DocAssociate/SessionClusterer/AnomalyDetector）共享同一个 Database 实例，
 * 避免多个独立连接指向同一 SQLite 文件导致的数据损坏。
 *
 * Step 0-16 共享基础设施
 */
import Database from 'better-sqlite3';
/**
 * 获取共享数据库连接。
 * 所有 embedding 模块必须通过此函数获取连接，不得自行创建。
 */
export declare function getSharedDb(dbPathOverride?: string): Database.Database;
/**
 * 关闭共享连接（用于重置/测试）。
 */
export declare function closeSharedDb(): void;
//# sourceMappingURL=db.d.ts.map