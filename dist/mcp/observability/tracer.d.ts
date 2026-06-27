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
import type { McpConfig } from '../config.js';
export interface SpanAttributes {
    [key: string]: string | number | boolean | undefined;
}
export interface SpanEvent {
    name: string;
    timestamp: string;
    attributes?: SpanAttributes;
}
export interface Span {
    /** Unique span ID */
    id: string;
    /** Parent span ID (for root spans, empty string) */
    parentId: string;
    /** Trace ID shared across all related spans */
    traceId: string;
    /** Human-readable operation name */
    name: string;
    /** Span kind */
    kind: 'server' | 'client' | 'internal';
    /** Start timestamp (ISO 8601) */
    startTime: string;
    /** End timestamp (ISO 8601), set on end() */
    endTime?: string;
    /** Duration in milliseconds */
    durationMs?: number;
    /** Key-value attributes */
    attributes: SpanAttributes;
    /** Timed events within the span */
    events: SpanEvent[];
    /** Whether the span completed successfully */
    status: 'ok' | 'error' | 'unset';
    /** Error message if status is 'error' */
    errorMessage?: string;
}
/**
 * Initialize the tracer with config.
 */
export declare function initTracer(config: McpConfig): void;
/**
 * Enable or disable tracing at runtime.
 */
export declare function setTracingEnabled(enabled: boolean): void;
/**
 * Check if tracing is currently enabled.
 */
export declare function isTracingEnabled(): boolean;
/**
 * Start a new span.
 *
 * @param name          - Operation name (e.g. "agent.invoke", "llm.call")
 * @param kind          - Span kind ('server' | 'client' | 'internal')
 * @param parentTraceId - Optional parent trace ID for span linking
 * @param attributes    - Initial attributes
 * @returns The created span
 */
export declare function startSpan(name: string, kind?: 'server' | 'client' | 'internal', parentTraceId?: string, attributes?: SpanAttributes): Span;
/**
 * End a span and record its duration.
 *
 * @param span          - The span to end
 * @param errorMessage  - Optional error message (sets status to 'error')
 */
export declare function endSpan(span: Span, errorMessage?: string): void;
/**
 * Add an event to a span.
 */
export declare function addSpanEvent(span: Span, eventName: string, attributes?: SpanAttributes): void;
/**
 * Set an attribute on a span.
 */
export declare function setSpanAttribute(span: Span, key: string, value: string | number | boolean): void;
/**
 * Set the error status on a span.
 */
export declare function setSpanError(span: Span, message: string): void;
/**
 * Get all completed spans for export/analysis.
 */
export declare function getCompletedSpans(): Span[];
/**
 * Get currently active spans.
 */
export declare function getActiveSpans(): Span[];
/**
 * Export all completed spans as JSON.
 */
export declare function exportTraceJSON(): string;
/**
 * Clear all stored span data.
 */
export declare function clearTraces(): void;
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
export declare function withSpan<T>(name: string, fn: (span: Span) => Promise<T>, kind?: 'server' | 'client' | 'internal', attributes?: SpanAttributes): Promise<T>;
/**
 * Create a child span from a parent.
 */
export declare function startChildSpan(parent: Span, name: string, kind?: 'client' | 'internal'): Span;
//# sourceMappingURL=tracer.d.ts.map