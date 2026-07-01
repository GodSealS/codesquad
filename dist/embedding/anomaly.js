/**
 * 异常检测 + 质量监控 — 检测工具循环、主题漂移、质量下降
 *
 * 检测维度：
 * 1. 工具循环：同一工具连续调用 >5 次且语义重复 → ⚠️
 * 2. 主题漂移：session embedding 偏离 normalCentroid → ⚠️
 * 3. 质量下降：连续 3 轮无实质产出 → ⚠️
 *
 * 🔧 R2-3: 冷启动基线（前 100 轮预热，使用 EMA 更新基线，预热期不告警）
 *
 * Step 16 / 18 执行步骤
 */
import { getSharedDb } from './db.js';
import { ANOMALY_LOG_DDL } from './schema.js';
import { getEmbeddingProvider, isSemanticEnabled } from './provider.js';
import { cosineSimilarity } from './store.js';
import { isDebugMode } from '../utils/debug.js';
const WARMUP_ROUNDS = 100;
const TOOL_LOOP_THRESHOLD = 5;
const TOPIC_DRIFT_THRESHOLD = 0.3;
const QUALITY_DROP_ROUNDS = 3;
const EMA_ALPHA = 0.1; // 指数移动平均平滑因子
export class AnomalyDetector {
    db;
    warmupRounds = WARMUP_ROUNDS;
    currentRound = 0;
    normalCentroid = null;
    toolCallHistory = [];
    recentOutputLengths = [];
    constructor(dbPathOverride) {
        this.db = getSharedDb(dbPathOverride);
        this.init();
    }
    init() {
        this.db.exec(ANOMALY_LOG_DDL);
    }
    /**
     * 每轮对话后调用，检测异常。
     *
     * 🔧 R2-3: 冷启动 — 前 warmupRounds 轮不告警，仅 EMA 更新基线
     */
    async check(sessionId, messages, toolCalls) {
        // Anomaly detection only runs in debug mode (CODESQUAD_DEBUG=1).
        // It requires embedding model loaded and adds compute overhead.
        if (!isDebugMode())
            return [];
        if (!isSemanticEnabled())
            return [];
        this.currentRound++;
        // 更新工具调用历史
        this.toolCallHistory.push(...toolCalls);
        // 只保留最近 20 次
        if (this.toolCallHistory.length > 20) {
            this.toolCallHistory = this.toolCallHistory.slice(-20);
        }
        // 跟踪最近输出长度
        const assistantMessages = messages.filter(m => m.role === 'assistant');
        for (const msg of assistantMessages.slice(-1)) {
            this.recentOutputLengths.push(msg.content.length);
            if (this.recentOutputLengths.length > 10) {
                this.recentOutputLengths.shift();
            }
        }
        // 🔧 R2-3: 预热期 — EMA 更新基线，不告警
        // 🔧 Bug Fix #5: 缓存 sessionEmb 避免重复 embed
        const provider = await getEmbeddingProvider();
        let sessionEmb = null;
        if (provider) {
            const sessionText = messages.map(m => m.content).join(' ').slice(0, 2000);
            sessionEmb = await provider.embed(sessionText);
            if (this.currentRound <= this.warmupRounds) {
                this.updateBaseline(sessionEmb);
                return [];
            }
        }
        // 正式检测
        const reports = [];
        // 1) 工具循环检测
        const loopReport = this.detectToolLoop();
        if (loopReport)
            reports.push(loopReport);
        // 2) 主题漂移检测（🔧 Bug Fix #5: 复用 sessionEmb 而非重新计算）
        if (sessionEmb && this.normalCentroid) {
            const driftReport = this.detectTopicDrift(sessionEmb);
            if (driftReport)
                reports.push(driftReport);
        }
        // 3) 质量下降检测
        const qualityReport = this.detectQualityDrop();
        if (qualityReport)
            reports.push(qualityReport);
        // 持久化
        for (const report of reports) {
            this.logAnomaly(sessionId, report);
        }
        return reports;
    }
    // ── 内部检测 ──
    detectToolLoop() {
        if (this.toolCallHistory.length < TOOL_LOOP_THRESHOLD)
            return null;
        // 检查最近 N 次是否都是同一工具
        const recent = this.toolCallHistory.slice(-TOOL_LOOP_THRESHOLD);
        const toolNames = new Set(recent.map(t => t.toolName));
        if (toolNames.size === 1) {
            const toolName = recent[0].toolName;
            return {
                type: 'tool-loop',
                severity: 'warning',
                message: `工具 ${toolName} 连续调用 ${TOOL_LOOP_THRESHOLD} 次，可能进入循环`,
                timestamp: new Date().toISOString(),
            };
        }
        // 检查输入是否语义重复（简化：相同工具 + 相似输入）
        if (toolNames.size <= 2) {
            const inputs = recent.map(t => t.input).filter(Boolean);
            const uniqueInputs = new Set(inputs);
            if (uniqueInputs.size <= 2 && inputs.length >= TOOL_LOOP_THRESHOLD) {
                return {
                    type: 'tool-loop',
                    severity: 'warning',
                    message: `工具 ${[...toolNames].join(', ')} 重复相似调用 ${TOOL_LOOP_THRESHOLD} 次`,
                    timestamp: new Date().toISOString(),
                };
            }
        }
        return null;
    }
    detectTopicDrift(sessionEmb) {
        if (!this.normalCentroid)
            return null;
        const similarity = cosineSimilarity(sessionEmb, this.normalCentroid);
        if (similarity < TOPIC_DRIFT_THRESHOLD) {
            return {
                type: 'topic-drift',
                severity: 'warning',
                message: `会话主题偏离正常基线 (相似度: ${(similarity * 100).toFixed(1)}%)`,
                timestamp: new Date().toISOString(),
            };
        }
        return null;
    }
    detectQualityDrop() {
        if (this.recentOutputLengths.length < QUALITY_DROP_ROUNDS)
            return null;
        const recent = this.recentOutputLengths.slice(-QUALITY_DROP_ROUNDS);
        const allShort = recent.every(len => len < 50);
        if (allShort) {
            return {
                type: 'quality-drop',
                severity: 'warning',
                message: `连续 ${QUALITY_DROP_ROUNDS} 轮助手回复短小（<50 字符），可能质量下降`,
                timestamp: new Date().toISOString(),
            };
        }
        return null;
    }
    // ── 基线更新 ──
    /** 🔧 R2-3: EMA 更新正常基线 */
    updateBaseline(sessionEmb) {
        if (!this.normalCentroid) {
            this.normalCentroid = new Float32Array(sessionEmb);
            return;
        }
        for (let i = 0; i < sessionEmb.length; i++) {
            this.normalCentroid[i] =
                EMA_ALPHA * sessionEmb[i] + (1 - EMA_ALPHA) * this.normalCentroid[i];
        }
    }
    // ── 持久化 ──
    logAnomaly(sessionId, report) {
        // Simple ID based on timestamp + type
        const id = `anomaly:${sessionId.slice(0, 8)}:${report.type}:${Date.now().toString(36)}`;
        this.db.prepare(/* sql */ `
      INSERT INTO anomaly_log (id, session_id, type, severity, message)
      VALUES (@id, @sessionId, @type, @severity, @message)
    `).run({
            id,
            sessionId,
            type: report.type,
            severity: report.severity,
            message: report.message,
        });
    }
    getRecentAnomalies(limit = 20) {
        const rows = this.db.prepare(/* sql */ `
      SELECT type, severity, message, timestamp
      FROM anomaly_log
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit);
        return rows.map(r => ({
            type: r.type,
            severity: r.severity,
            message: r.message,
            timestamp: r.timestamp,
        }));
    }
    /** 重置状态（用于新会话或测试）。 */
    reset() {
        this.currentRound = 0;
        this.normalCentroid = null;
        this.toolCallHistory = [];
        this.recentOutputLengths = [];
    }
    close() {
        // 共享连接不在此关闭
    }
}
// ── 全局单例 ──
let anomalyInstance = null;
export function getAnomalyDetector() {
    if (!anomalyInstance) {
        anomalyInstance = new AnomalyDetector();
    }
    return anomalyInstance;
}
export function resetAnomalyDetector() {
    anomalyInstance = null;
}
//# sourceMappingURL=anomaly.js.map