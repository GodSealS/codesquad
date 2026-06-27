/**
 * Tracer — Lightweight OpenTelemetry-compatible Tracing
 *
 * Provides structured span-based tracing for agent/skill invocations.
 * Designed to be compatible with OpenTelemetry exporters (Jaeger, Zipkin, OTLP)
 * without requiring the full @opentelemetry/api dependency at build time.
 *
 * Features:
 *   - Span creation with parent-child relationships
 *   - Span attributes and events
 *   - Timing (start/end durations)
 *   - JSON export for offline analysis
 *   - Configurable via mcp.config.yaml (observability.tracing.enabled)
 *
 * In production, can be swapped out for full OTel SDK.
 */
import { logger } from './logger.js';
// ── Tracer State ──
let traceCounter = 0;
let _enabled = false;
/** Active spans keyed by ID */
const activeSpans = new Map();
/** Completed spans for export */
const completedSpans = [];
const MAX_COMPLETED_SPANS = 10_000;
/**
 * Initialize the tracer with config.
 */
export function initTracer(config) {
    _enabled = config.observability?.trace_enabled ?? false;
    if (_enabled) {
        logger.info('Tracing enabled', 'tracer');
    }
}
/**
 * Enable or disable tracing at runtime.
 */
export function setTracingEnabled(enabled) {
    _enabled = enabled;
}
/**
 * Check if tracing is currently enabled.
 */
export function isTracingEnabled() {
    return _enabled;
}
// ── Span Management ──
/**
 * Start a new span.
 *
 * @param name          - Operation name (e.g. "agent.invoke", "llm.call")
 * @param kind          - Span kind ('server' | 'client' | 'internal')
 * @param parentTraceId - Optional parent trace ID for span linking
 * @param attributes    - Initial attributes
 * @returns The created span
 */
export function startSpan(name, kind = 'internal', parentTraceId, attributes) {
    traceCounter++;
    const spanId = `span_${traceCounter}_${Date.now()}`;
    const traceId = parentTraceId ?? `trace_${traceCounter}`;
    const span = {
        id: spanId,
        parentId: parentTraceId ? `parent_${parentTraceId}` : '',
        traceId,
        name,
        kind,
        startTime: new Date().toISOString(),
        attributes: attributes ?? {},
        events: [],
        status: 'unset',
    };
    activeSpans.set(spanId, span);
    if (_enabled) {
        logger.debug(`Span started: ${name}`, 'tracer', { spanId, traceId, kind });
    }
    return span;
}
/**
 * End a span and record its duration.
 *
 * @param span          - The span to end
 * @param errorMessage  - Optional error message (sets status to 'error')
 */
export function endSpan(span, errorMessage) {
    if (span.endTime)
        return; // Already ended
    span.endTime = new Date().toISOString();
    span.durationMs = new Date(span.endTime).getTime() - new Date(span.startTime).getTime();
    if (errorMessage) {
        span.status = 'error';
        span.errorMessage = errorMessage;
    }
    else {
        span.status = 'ok';
    }
    activeSpans.delete(span.id);
    // Store completed span
    completedSpans.push(span);
    if (completedSpans.length > MAX_COMPLETED_SPANS) {
        completedSpans.shift();
    }
    if (_enabled) {
        logger.debug(`Span ended: ${span.name} (${span.durationMs}ms, ${span.status})`, 'tracer', { spanId: span.id, traceId: span.traceId, durationMs: span.durationMs, status: span.status });
    }
}
/**
 * Add an event to a span.
 */
export function addSpanEvent(span, eventName, attributes) {
    span.events.push({
        name: eventName,
        timestamp: new Date().toISOString(),
        attributes,
    });
    if (_enabled) {
        logger.trace(`Span event: ${span.name} → ${eventName}`, 'tracer', { spanId: span.id });
    }
}
/**
 * Set an attribute on a span.
 */
export function setSpanAttribute(span, key, value) {
    span.attributes[key] = value;
}
/**
 * Set the error status on a span.
 */
export function setSpanError(span, message) {
    span.status = 'error';
    span.errorMessage = message;
}
// ── Trace Export ──
/**
 * Get all completed spans for export/analysis.
 */
export function getCompletedSpans() {
    return [...completedSpans];
}
/**
 * Get currently active spans.
 */
export function getActiveSpans() {
    return [...activeSpans.values()];
}
/**
 * Export all completed spans as JSON.
 */
export function exportTraceJSON() {
    return JSON.stringify({
        exportTime: new Date().toISOString(),
        spanCount: completedSpans.length,
        spans: completedSpans,
    }, null, 2);
}
/**
 * Clear all stored span data.
 */
export function clearTraces() {
    completedSpans.length = 0;
    activeSpans.clear();
}
// ── Convenience Wrappers ──
/**
 * Execute an async function within a traced span.
 * Automatically starts and ends the span, recording errors.
 *
 * @param name       - Span name
 * @param fn         - Async function to execute
 * @param kind       - Span kind
 * @param attributes - Initial attributes
 * @returns The function's return value
 */
export async function withSpan(name, fn, kind = 'internal', attributes) {
    const span = startSpan(name, kind, undefined, attributes);
    try {
        const result = await fn(span);
        endSpan(span);
        return result;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        endSpan(span, message);
        throw err;
    }
}
/**
 * Create a child span from a parent.
 */
export function startChildSpan(parent, name, kind = 'internal') {
    return startSpan(name, kind, parent.traceId);
}
//# sourceMappingURL=tracer.js.map