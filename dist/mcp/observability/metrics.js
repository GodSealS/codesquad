/**
 * Metrics — Lightweight In-Process Counters
 *
 * Tracks agent/skill invocation counts, LLM call metrics, and error rates.
 * Designed for Prometheus scraping via /metrics endpoint (future HTTP export).
 * No external dependencies — pure in-process counters.
 */
class MetricsRegistry {
    counters = new Map();
    histograms = new Map();
    gauges = new Map();
    enabled = true;
    /** Enable/disable metrics collection */
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    /** Increment a counter */
    inc(name, labels, delta = 1) {
        if (!this.enabled)
            return;
        const key = this.buildKey(name, labels);
        const existing = this.counters.get(key);
        if (existing) {
            existing.value += delta;
        }
        else {
            this.counters.set(key, { name, value: delta, labels });
        }
    }
    /** Observe a histogram value (e.g., duration) */
    observe(name, value, labels) {
        if (!this.enabled)
            return;
        const key = this.buildKey(name, labels);
        const existing = this.histograms.get(key);
        if (existing) {
            existing.values.push(value);
        }
        else {
            this.histograms.set(key, { name, values: [value], labels });
        }
    }
    /** Set a gauge */
    gauge(name, value, labels) {
        if (!this.enabled)
            return;
        const key = this.buildKey(name, labels);
        this.gauges.set(key, { name, value, labels });
    }
    /** Get all counters (for /metrics export) */
    getCounters() {
        return Array.from(this.counters.values());
    }
    /** Get histogram summaries (p50/p95/p99) */
    getHistogramSummaries() {
        return Array.from(this.histograms.values()).map(h => {
            const sorted = [...h.values].sort((a, b) => a - b);
            const len = sorted.length;
            return {
                name: h.name,
                labels: h.labels,
                p50: percentile(sorted, 50),
                p95: percentile(sorted, 95),
                p99: percentile(sorted, 99),
                count: len,
            };
        });
    }
    /** Get all gauges */
    getGauges() {
        return Array.from(this.gauges.values());
    }
    /** Reset all metrics */
    reset() {
        this.counters.clear();
        this.histograms.clear();
        this.gauges.clear();
    }
    /** Snapshot and reset (for periodic export) */
    snapshot() {
        const snap = {
            counters: this.getCounters().map(c => ({ ...c })),
            histograms: Array.from(this.histograms.values()).map(h => ({ ...h, values: [...h.values] })),
            gauges: this.getGauges().map(g => ({ ...g })),
        };
        this.reset();
        return snap;
    }
    buildKey(name, labels) {
        if (!labels)
            return name;
        const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
        return `${name}{${sorted.map(([k, v]) => `${k}=${v}`).join(',')}}`;
    }
}
function percentile(sorted, p) {
    if (sorted.length === 0)
        return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))] ?? 0;
}
// ── Singleton ──
export const metrics = new MetricsRegistry();
// ── Convenience Trackers ──
/** Track agent.invoke call */
export function trackAgentInvoke(agentName, durationMs, success) {
    metrics.inc('codesquad_agent_invoke_total', { agent: agentName, status: success ? 'success' : 'failure' });
    metrics.observe('codesquad_agent_invoke_duration_ms', durationMs, { agent: agentName });
    if (!success) {
        metrics.inc('codesquad_agent_invoke_errors_total', { agent: agentName });
    }
}
/** Track skill.invoke call */
export function trackSkillInvoke(skillName, durationMs, success) {
    metrics.inc('codesquad_skill_invoke_total', { skill: skillName, status: success ? 'success' : 'failure' });
    metrics.observe('codesquad_skill_invoke_duration_ms', durationMs, { skill: skillName });
}
/** Track LLM API call */
export function trackLlmCall(provider, model, durationMs, tokens, success) {
    metrics.inc('codesquad_llm_call_total', { provider, model, status: success ? 'success' : 'failure' });
    metrics.observe('codesquad_llm_call_duration_ms', durationMs, { provider, model });
    metrics.inc('codesquad_llm_tokens_total', { provider, model }, tokens);
    if (!success) {
        metrics.inc('codesquad_llm_call_errors_total', { provider, model });
    }
}
/** Track external MCP proxy call */
export function trackExternalMcpCall(server, tool, durationMs, success) {
    metrics.inc('codesquad_external_mcp_call_total', { server, tool, status: success ? 'success' : 'failure' });
    metrics.observe('codesquad_external_mcp_call_duration_ms', durationMs, { server });
}
//# sourceMappingURL=metrics.js.map