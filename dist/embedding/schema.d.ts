/**
 * 语义上下文检索系统 — 全部 SQLite 表结构（DDL）
 *
 * 定义所有 Phase 使用的表，各 Step 按需创建。
 * Step 0 / 18 执行步骤
 */
export declare const TABLE_NAMES: {
    readonly messageEmbeddings: "message_embeddings";
    readonly codeEmbeddings: "code_embeddings";
    readonly docEmbeddings: "doc_embeddings";
    readonly exampleEmbeddings: "example_embeddings";
    readonly sessionClusters: "session_clusters";
    readonly toolDedupCache: "tool_dedup_cache";
    readonly i18nCheckResults: "i18n_check_results";
    readonly anomalyLog: "anomaly_log";
};
export declare const MESSAGE_EMBEDDINGS_DDL = "\nCREATE TABLE IF NOT EXISTS message_embeddings (\n  id                TEXT PRIMARY KEY NOT NULL,\n  session_id        TEXT NOT NULL,\n  message_index     INTEGER NOT NULL,\n  role              TEXT NOT NULL,\n  content           TEXT NOT NULL,\n  summary           TEXT NOT NULL DEFAULT '',\n  content_embedding BLOB NOT NULL,\n  summary_embedding BLOB,\n  created_at        TEXT NOT NULL DEFAULT (datetime('now')),\n  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))\n);\n\nCREATE INDEX IF NOT EXISTS idx_msg_emb_session\n  ON message_embeddings(session_id);\n\nCREATE INDEX IF NOT EXISTS idx_msg_emb_session_index\n  ON message_embeddings(session_id, message_index);\n";
export declare const CODE_EMBEDDINGS_DDL = "\nCREATE TABLE IF NOT EXISTS code_embeddings (\n  id          TEXT PRIMARY KEY NOT NULL,\n  file_path   TEXT NOT NULL,\n  start_line  INTEGER NOT NULL,\n  end_line    INTEGER NOT NULL,\n  content     TEXT NOT NULL,\n  summary     TEXT NOT NULL DEFAULT '',\n  symbols     TEXT NOT NULL DEFAULT '[]',\n  embedding   BLOB NOT NULL,\n  created_at  TEXT NOT NULL DEFAULT (datetime('now')),\n  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))\n);\n\nCREATE INDEX IF NOT EXISTS idx_code_emb_file\n  ON code_embeddings(file_path);\n\nCREATE INDEX IF NOT EXISTS idx_code_emb_symbols\n  ON code_embeddings(symbols);\n";
export declare const DOC_EMBEDDINGS_DDL = "\nCREATE TABLE IF NOT EXISTS doc_embeddings (\n  id           TEXT PRIMARY KEY NOT NULL,\n  file_path    TEXT NOT NULL,\n  chunk_index  INTEGER NOT NULL,\n  content      TEXT NOT NULL,\n  content_hash TEXT NOT NULL,\n  embedding    BLOB NOT NULL,\n  created_at   TEXT NOT NULL DEFAULT (datetime('now')),\n  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))\n);\n\nCREATE UNIQUE INDEX IF NOT EXISTS idx_doc_emb_hash\n  ON doc_embeddings(content_hash);\n\nCREATE INDEX IF NOT EXISTS idx_doc_emb_file\n  ON doc_embeddings(file_path);\n";
export declare const EXAMPLE_EMBEDDINGS_DDL = "\nCREATE TABLE IF NOT EXISTS example_embeddings (\n  id               TEXT PRIMARY KEY NOT NULL,\n  session_id       TEXT NOT NULL,\n  user_input       TEXT NOT NULL,\n  assistant_output TEXT NOT NULL,\n  quality          INTEGER NOT NULL DEFAULT 3 CHECK(quality >= 1 AND quality <= 5),\n  embedding        BLOB NOT NULL,\n  created_at       TEXT NOT NULL DEFAULT (datetime('now'))\n);\n\nCREATE INDEX IF NOT EXISTS idx_example_emb_quality\n  ON example_embeddings(quality DESC);\n";
export declare const SESSION_CLUSTERS_DDL = "\nCREATE TABLE IF NOT EXISTS session_clusters (\n  id                 TEXT PRIMARY KEY NOT NULL,\n  topic              TEXT NOT NULL,\n  session_ids        TEXT NOT NULL DEFAULT '[]',\n  centroid_embedding BLOB NOT NULL,\n  knowledge_items    TEXT NOT NULL DEFAULT '[]',\n  created_at         TEXT NOT NULL DEFAULT (datetime('now')),\n  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))\n);\n\nCREATE INDEX IF NOT EXISTS idx_cluster_topic\n  ON session_clusters(topic);\n";
export declare const TOOL_DEDUP_CACHE_DDL = "\nCREATE TABLE IF NOT EXISTS tool_dedup_cache (\n  id           TEXT PRIMARY KEY NOT NULL,\n  tool_name    TEXT NOT NULL,\n  semantic_key TEXT NOT NULL,\n  result       TEXT NOT NULL,\n  cached_at    REAL NOT NULL,\n  ttl          REAL NOT NULL,\n  file_mtime   REAL\n);\n\nCREATE INDEX IF NOT EXISTS idx_tool_dedup_lookup\n  ON tool_dedup_cache(tool_name, semantic_key);\n\nCREATE INDEX IF NOT EXISTS idx_tool_dedup_expires\n  ON tool_dedup_cache(cached_at, ttl);\n";
export declare const I18N_CHECK_RESULTS_DDL = "\nCREATE TABLE IF NOT EXISTS i18n_check_results (\n  id              TEXT PRIMARY KEY NOT NULL,\n  source_path     TEXT NOT NULL,\n  target_path     TEXT NOT NULL,\n  source_lang     TEXT NOT NULL,\n  target_lang     TEXT NOT NULL,\n  similarity      REAL NOT NULL,\n  missing_sections TEXT NOT NULL DEFAULT '[]',\n  checked_at      TEXT NOT NULL DEFAULT (datetime('now'))\n);\n\nCREATE INDEX IF NOT EXISTS idx_i18n_langs\n  ON i18n_check_results(source_lang, target_lang);\n";
export declare const ANOMALY_LOG_DDL = "\nCREATE TABLE IF NOT EXISTS anomaly_log (\n  id          TEXT PRIMARY KEY NOT NULL,\n  session_id  TEXT NOT NULL,\n  type        TEXT NOT NULL CHECK(type IN ('tool-loop', 'topic-drift', 'quality-drop')),\n  severity    TEXT NOT NULL CHECK(severity IN ('warning', 'critical')),\n  message     TEXT NOT NULL,\n  timestamp   TEXT NOT NULL DEFAULT (datetime('now'))\n);\n\nCREATE INDEX IF NOT EXISTS idx_anomaly_session\n  ON anomaly_log(session_id);\n\nCREATE INDEX IF NOT EXISTS idx_anomaly_timestamp\n  ON anomaly_log(timestamp);\n";
export declare const ALL_DDLS: readonly {
    name: string;
    sql: string;
}[];
//# sourceMappingURL=schema.d.ts.map