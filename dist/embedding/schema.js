/**
 * 语义上下文检索系统 — 全部 SQLite 表结构（DDL）
 *
 * 定义所有 Phase 使用的表，各 Step 按需创建。
 * Step 0 / 18 执行步骤
 */
// ============================================================
// 表名常量
// ============================================================
export const TABLE_NAMES = {
    messageEmbeddings: 'message_embeddings',
    codeEmbeddings: 'code_embeddings',
    docEmbeddings: 'doc_embeddings',
    exampleEmbeddings: 'example_embeddings',
    sessionClusters: 'session_clusters',
    toolDedupCache: 'tool_dedup_cache',
    i18nCheckResults: 'i18n_check_results',
    anomalyLog: 'anomaly_log',
};
// ============================================================
// 消息 Embedding 表（Step 2 创建）
// 用于跨 Session 语义检索
// ============================================================
export const MESSAGE_EMBEDDINGS_DDL = /* sql */ `
CREATE TABLE IF NOT EXISTS message_embeddings (
  id                TEXT PRIMARY KEY NOT NULL,
  session_id        TEXT NOT NULL,
  message_index     INTEGER NOT NULL,
  role              TEXT NOT NULL,
  content           TEXT NOT NULL,
  summary           TEXT NOT NULL DEFAULT '',
  content_embedding BLOB NOT NULL,
  summary_embedding BLOB,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_msg_emb_session
  ON message_embeddings(session_id);

CREATE INDEX IF NOT EXISTS idx_msg_emb_session_index
  ON message_embeddings(session_id, message_index);
`;
// ============================================================
// 代码 Embedding 表（Step 10 创建）
// 用于自然语言搜索代码
// ============================================================
export const CODE_EMBEDDINGS_DDL = /* sql */ `
CREATE TABLE IF NOT EXISTS code_embeddings (
  id          TEXT PRIMARY KEY NOT NULL,
  file_path   TEXT NOT NULL,
  start_line  INTEGER NOT NULL,
  end_line    INTEGER NOT NULL,
  content     TEXT NOT NULL,
  summary     TEXT NOT NULL DEFAULT '',
  symbols     TEXT NOT NULL DEFAULT '[]',
  embedding   BLOB NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_code_emb_file
  ON code_embeddings(file_path);

CREATE INDEX IF NOT EXISTS idx_code_emb_symbols
  ON code_embeddings(symbols);
`;
// ============================================================
// 文档 Embedding 表（Step 12 创建）
// 用于自动关联项目设计文档
// ============================================================
export const DOC_EMBEDDINGS_DDL = /* sql */ `
CREATE TABLE IF NOT EXISTS doc_embeddings (
  id           TEXT PRIMARY KEY NOT NULL,
  file_path    TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding    BLOB NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_emb_hash
  ON doc_embeddings(content_hash);

CREATE INDEX IF NOT EXISTS idx_doc_emb_file
  ON doc_embeddings(file_path);
`;
// ============================================================
// Few-Shot 示例 Embedding 表（Step 11 创建）
// 用于从历史成功对话中检索相似示例
// ============================================================
export const EXAMPLE_EMBEDDINGS_DDL = /* sql */ `
CREATE TABLE IF NOT EXISTS example_embeddings (
  id               TEXT PRIMARY KEY NOT NULL,
  session_id       TEXT NOT NULL,
  user_input       TEXT NOT NULL,
  assistant_output TEXT NOT NULL,
  quality          INTEGER NOT NULL DEFAULT 3 CHECK(quality >= 1 AND quality <= 5),
  embedding        BLOB NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_example_emb_quality
  ON example_embeddings(quality DESC);
`;
// ============================================================
// 会话聚类表（Step 15 创建）
// 存储按主题聚类的结果
// ============================================================
export const SESSION_CLUSTERS_DDL = /* sql */ `
CREATE TABLE IF NOT EXISTS session_clusters (
  id                 TEXT PRIMARY KEY NOT NULL,
  topic              TEXT NOT NULL,
  session_ids        TEXT NOT NULL DEFAULT '[]',
  centroid_embedding BLOB NOT NULL,
  knowledge_items    TEXT NOT NULL DEFAULT '[]',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cluster_topic
  ON session_clusters(topic);
`;
// ============================================================
// 工具去重缓存表（Step 13 创建）
// 语义相同但字面不同的工具调用复用缓存
// ============================================================
export const TOOL_DEDUP_CACHE_DDL = /* sql */ `
CREATE TABLE IF NOT EXISTS tool_dedup_cache (
  id           TEXT PRIMARY KEY NOT NULL,
  tool_name    TEXT NOT NULL,
  semantic_key TEXT NOT NULL,
  result       TEXT NOT NULL,
  cached_at    REAL NOT NULL,
  ttl          REAL NOT NULL,
  file_mtime   REAL
);

CREATE INDEX IF NOT EXISTS idx_tool_dedup_lookup
  ON tool_dedup_cache(tool_name, semantic_key);

CREATE INDEX IF NOT EXISTS idx_tool_dedup_expires
  ON tool_dedup_cache(cached_at, ttl);
`;
// ============================================================
// 多语言对齐检测结果表（Step 14 创建）
// ============================================================
export const I18N_CHECK_RESULTS_DDL = /* sql */ `
CREATE TABLE IF NOT EXISTS i18n_check_results (
  id              TEXT PRIMARY KEY NOT NULL,
  source_path     TEXT NOT NULL,
  target_path     TEXT NOT NULL,
  source_lang     TEXT NOT NULL,
  target_lang     TEXT NOT NULL,
  similarity      REAL NOT NULL,
  missing_sections TEXT NOT NULL DEFAULT '[]',
  checked_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_i18n_langs
  ON i18n_check_results(source_lang, target_lang);
`;
// ============================================================
// 异常检测日志表（Step 16 创建）
// ============================================================
export const ANOMALY_LOG_DDL = /* sql */ `
CREATE TABLE IF NOT EXISTS anomaly_log (
  id          TEXT PRIMARY KEY NOT NULL,
  session_id  TEXT NOT NULL,
  type        TEXT NOT NULL CHECK(type IN ('tool-loop', 'topic-drift', 'quality-drop')),
  severity    TEXT NOT NULL CHECK(severity IN ('warning', 'critical')),
  message     TEXT NOT NULL,
  timestamp   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_anomaly_session
  ON anomaly_log(session_id);

CREATE INDEX IF NOT EXISTS idx_anomaly_timestamp
  ON anomaly_log(timestamp);
`;
// ============================================================
// 全部 DDL 列表（按创建顺序）
// ============================================================
export const ALL_DDLS = [
    { name: 'message_embeddings', sql: MESSAGE_EMBEDDINGS_DDL },
    { name: 'code_embeddings', sql: CODE_EMBEDDINGS_DDL },
    { name: 'doc_embeddings', sql: DOC_EMBEDDINGS_DDL },
    { name: 'example_embeddings', sql: EXAMPLE_EMBEDDINGS_DDL },
    { name: 'session_clusters', sql: SESSION_CLUSTERS_DDL },
    { name: 'tool_dedup_cache', sql: TOOL_DEDUP_CACHE_DDL },
    { name: 'i18n_check_results', sql: I18N_CHECK_RESULTS_DDL },
    { name: 'anomaly_log', sql: ANOMALY_LOG_DDL },
];
//# sourceMappingURL=schema.js.map