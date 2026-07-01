/**
 * Few-Shot 示例检索 — 从历史成功对话中检索最相似示例
 *
 * 收集触发：
 * - 👍 → quality=4
 * - ❤️ → quality=5
 * - 未反馈但产出被接受 → quality=3（隐式）
 *
 * 案例库最多保留 1000 条，LRU 淘汰。
 *
 * Step 11 / 18 执行步骤
 */
import { getSharedDb } from './db.js';
import { EXAMPLE_EMBEDDINGS_DDL } from './schema.js';
import { getEmbeddingProvider } from './provider.js';
import { cosineSimilarity, serializeEmbedding, deserializeEmbedding } from './store.js';
const MAX_EXAMPLES = 1000;
export class ExampleStore {
    db;
    constructor(dbPathOverride) {
        this.db = getSharedDb(dbPathOverride);
        this.init();
    }
    init() {
        this.db.exec(EXAMPLE_EMBEDDINGS_DDL);
    }
    /**
     * 收集示例（用户 👍/❤️ 之后调用）。
     */
    async collect(userInput, assistantOutput, sessionId, quality = 3) {
        const provider = await getEmbeddingProvider();
        if (!provider)
            return;
        const emb = await provider.embed(userInput);
        // Simple hash-based ID
        const id = `ex:${sessionId.slice(0, 8)}:${Date.now().toString(36)}`;
        this.db.prepare(/* sql */ `
      INSERT INTO example_embeddings (id, session_id, user_input, assistant_output, quality, embedding)
      VALUES (@id, @sessionId, @userInput, @assistantOutput, @quality, @embedding)
    `).run({
            id,
            sessionId,
            userInput,
            assistantOutput,
            quality,
            embedding: serializeEmbedding(emb),
        });
        // LRU 淘汰
        this.evict();
    }
    /**
     * 检索与 userInput 最相似的 Top-N 示例。
     */
    async retrieve(userInput, topN = 3) {
        const provider = await getEmbeddingProvider();
        if (!provider)
            return [];
        const queryEmb = await provider.embed(userInput);
        const rows = this.db.prepare(/* sql */ `
      SELECT id, session_id, user_input, assistant_output, quality, embedding
      FROM example_embeddings
    `).all();
        if (rows.length === 0)
            return [];
        const scored = rows.map(row => ({
            example: {
                id: row.id,
                sessionId: row.session_id,
                userInput: row.user_input,
                assistantOutput: row.assistant_output,
                quality: row.quality,
                createdAt: '',
            },
            similarity: cosineSimilarity(queryEmb, deserializeEmbedding(row.embedding)),
        }));
        // 按质量×相似度综合排序
        scored.sort((a, b) => (b.example.quality * b.similarity) - (a.example.quality * a.similarity));
        return scored.slice(0, topN).map(s => s.example);
    }
    /**
     * 格式化示例用于 system prompt 注入。
     */
    formatForPrompt(examples) {
        if (examples.length === 0)
            return '';
        const lines = [
            '**⭐ 相关历史案例：**',
            '',
        ];
        for (const ex of examples) {
            const qStar = '⭐'.repeat(ex.quality);
            lines.push(`**[${qStar}] 用户问：** ${ex.userInput.slice(0, 200)}`);
            lines.push(`**回答：** ${ex.assistantOutput.slice(0, 300)}`);
            lines.push('');
        }
        return lines.join('\n');
    }
    // ── 维护 ──
    evict() {
        const count = this.db.prepare('SELECT COUNT(*) as cnt FROM example_embeddings').get().cnt;
        if (count > MAX_EXAMPLES) {
            const excess = count - MAX_EXAMPLES;
            this.db.prepare('DELETE FROM example_embeddings WHERE id IN (SELECT id FROM example_embeddings ORDER BY quality ASC, created_at ASC LIMIT ?)').run(excess);
        }
    }
    get count() {
        return this.db.prepare('SELECT COUNT(*) as cnt FROM example_embeddings').get().cnt;
    }
    close() {
        // 共享连接不在此关闭
    }
}
// ── 全局单例 ──
let exampleStore = null;
export function getExampleStore() {
    if (!exampleStore) {
        exampleStore = new ExampleStore();
    }
    return exampleStore;
}
export function resetExampleStore() {
    exampleStore = null;
}
//# sourceMappingURL=examples.js.map