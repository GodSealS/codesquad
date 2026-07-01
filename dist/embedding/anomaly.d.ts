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
import type { AnomalyReport } from './types.js';
export declare class AnomalyDetector {
    private db;
    private warmupRounds;
    private currentRound;
    private normalCentroid;
    private toolCallHistory;
    private recentOutputLengths;
    constructor(dbPathOverride?: string);
    private init;
    /**
     * 每轮对话后调用，检测异常。
     *
     * 🔧 R2-3: 冷启动 — 前 warmupRounds 轮不告警，仅 EMA 更新基线
     */
    check(sessionId: string, messages: Array<{
        role: string;
        content: string;
    }>, toolCalls: Array<{
        toolName: string;
        input: string;
    }>): Promise<AnomalyReport[]>;
    private detectToolLoop;
    private detectTopicDrift;
    private detectQualityDrop;
    /** 🔧 R2-3: EMA 更新正常基线 */
    private updateBaseline;
    private logAnomaly;
    getRecentAnomalies(limit?: number): AnomalyReport[];
    /** 重置状态（用于新会话或测试）。 */
    reset(): void;
    close(): void;
}
export declare function getAnomalyDetector(): AnomalyDetector;
export declare function resetAnomalyDetector(): void;
//# sourceMappingURL=anomaly.d.ts.map