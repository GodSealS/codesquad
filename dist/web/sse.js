/**
 * Server-Sent Events utility for the Web Console.
 *
 * Provides a stream-friendly response wrapper that encodes SSE
 * protocol (event/data pairs) and manages connection lifecycle.
 */
/**
 * Create an SSE stream attached to the given HTTP response.
 * Writes headers immediately and returns a stream controller.
 */
export function createSSEStream(res) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
    });
    const send = (event, data) => {
        if (res.writableEnded)
            return;
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    const close = () => {
        if (res.writableEnded)
            return;
        res.write('event: done\ndata: {}\n\n');
        res.end();
    };
    const error = (code, message) => {
        if (res.writableEnded)
            return;
        res.write(`event: error\ndata: ${JSON.stringify({ code, message })}\n\n`);
        res.end();
    };
    return {
        send,
        close,
        error,
        get closed() {
            return res.writableEnded;
        },
    };
}
//# sourceMappingURL=sse.js.map