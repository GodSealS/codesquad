/**
 * Metrics — Lightweight In-Process Counters
 *
 * Tracks agent/skill invocation counts, LLM call metrics, and error rates.
 * Designed for Prometheus scraping via /metrics endpoint (future HTTP export).
 * No external dependencies — pure in-process counters.
 */
interface MetricCounter {
    name: string;
    value: number;
    labels?: Record<string, string>;
}
interface MetricHistogram {
    name: string;
    values: number[];
    labels?: Record<string, string>;
}
interface MetricGauge {
    name: string;
    value: number;
    labels?: Record<string, string>;
}
declare class MetricsRegistry {
    private counters;
    private histograms;
    private gauges;
    private enabled;
    /** Enable/disable metrics collection */
    setEnabled(enabled: boolean): void;
    /** Increment a counter */
    inc(name: string, labels?: Record<string, string>, delta?: number): void;
    /** Observe a histogram value (e.g., duration) */
    observe(name: string, value: number, labels?: Record<string, string>): void;
    /** Set a gauge */
    gauge(name: string, value: number, labels?: Record<string, string>): void;
    /** Get all counters (for /metrics export) */
    getCounters(): MetricCounter[];
    /** Get histogram summaries (p50/p95/p99) */
    getHistogramSummaries(): Array<{
        name: string;
        labels?: Record<string, string>;
        p50: number;
        p95: number;
        p99: number;
        count: number;
    }>;
    /** Get all gauges */
    getGauges(): MetricGauge[];
    /** Reset all metrics */
    reset(): void;
    /** Snapshot and reset (for periodic export) */
    snapshot(): {
        counters: MetricCounter[];
        histograms: MetricHistogram[];
        gauges: MetricGauge[];
    };
    private buildKey;
}
export declare const metrics: MetricsRegistry;
/** Track agent.invoke call */
export declare function trackAgentInvoke(agentName: string, durationMs: number, success: boolean): void;
/** Track skill.invoke call */
export declare function trackSkillInvoke(skillName: string, durationMs: number, success: boolean): void;
/** Track LLM API call */
export declare function trackLlmCall(provider: string, model: string, durationMs: number, tokens: number, success: boolean): void;
/** Track external MCP proxy call */
export declare function trackExternalMcpCall(server: string, tool: string, durationMs: number, success: boolean): void;
export {};
//# sourceMappingURL=metrics.d.ts.map