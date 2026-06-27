/**
 * Server-Sent Events utility for the Web Console.
 *
 * Provides a stream-friendly response wrapper that encodes SSE
 * protocol (event/data pairs) and manages connection lifecycle.
 */
import type http from 'http';
export interface SSEStream {
    /** Send an event with JSON-encoded data. */
    send(event: string, data: unknown): void;
    /** End the stream gracefully. */
    close(): void;
    /** End the stream with an error event. */
    error(code: number, message: string): void;
    /** Whether the underlying response has been closed. */
    readonly closed: boolean;
}
/**
 * Create an SSE stream attached to the given HTTP response.
 * Writes headers immediately and returns a stream controller.
 */
export declare function createSSEStream(res: http.ServerResponse): SSEStream;
//# sourceMappingURL=sse.d.ts.map