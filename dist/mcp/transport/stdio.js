/**
 * MCP Transport: stdio
 *
 * Implements JSON-RPC 2.0 over stdin/stdout for IDE integration.
 * stderr is used for server logging only (not protocol messages).
 */
import { createInterface } from 'readline';
/** Stdio transport for MCP Server */
export class StdioTransport {
    requestHandler = null;
    notificationHandler = null;
    rl = null;
    started = false;
    /** Start listening on stdin */
    start(onRequest, onNotification) {
        if (this.started)
            return;
        this.started = true;
        this.requestHandler = onRequest;
        this.notificationHandler = onNotification ?? (() => { });
        this.rl = createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false,
        });
        this.rl.on('line', (line) => {
            const trimmed = line.trim();
            if (!trimmed)
                return;
            try {
                const msg = JSON.parse(trimmed);
                // Notifications have no id
                if ('method' in msg && (msg.id === undefined || msg.id === null)) {
                    this.notificationHandler?.(msg);
                    return;
                }
                // Handle request
                if ('method' in msg) {
                    this.handleRequest(msg);
                }
            }
            catch {
                // Malformed JSON — log to stderr
                console.error('[mcp] Failed to parse message:', trimmed.slice(0, 200));
            }
        });
        this.rl.on('close', () => {
            this.started = false;
        });
    }
    /** Handle a single request and send response */
    async handleRequest(request) {
        try {
            const response = await this.requestHandler(request);
            // JSON-RPC 2.0: notifications (no id) MUST NOT receive a response
            if (response.id === undefined && response.id !== null)
                return;
            this.send(response);
        }
        catch (err) {
            // Don't send error responses for notifications either
            if (request.id === undefined)
                return;
            const error = err instanceof Error ? err : new Error(String(err));
            this.send({
                jsonrpc: '2.0',
                id: request.id ?? null,
                error: {
                    code: -32603,
                    message: error.message,
                },
            });
        }
    }
    /** Send a JSON-RPC message to stdout */
    send(message) {
        const line = JSON.stringify(message);
        process.stdout.write(line + '\n');
    }
    /** Log a message to stderr (not protocol) */
    log(message) {
        console.error(`[mcp] ${message}`);
    }
    /** Stop the transport */
    stop() {
        this.rl?.close();
        this.started = false;
    }
    get isRunning() {
        return this.started;
    }
}
//# sourceMappingURL=stdio.js.map