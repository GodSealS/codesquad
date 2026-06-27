/**
 * MCP Transport: HTTP (JSON-RPC 2.0 over HTTP POST)
 *
 * Exposes MCP Server as a REST-ish HTTP endpoint for CI/remote use.
 * Supports token-based authentication and health check endpoints.
 *
 * Per D-03: Default bind 127.0.0.1, TLS via reverse proxy.
 */
import http from 'http';
import { healthCheck, readinessCheck } from '../health.js';
/** Maximum number of consecutive ports to try when the preferred port is busy */
const PORT_RETRY_COUNT = 10;
/**
 * Find an available port starting from `preferred`, trying up to `maxRetries`
 * consecutive ports. Returns the first port that is not in use.
 * Throws if no port is available in the range.
 */
export async function findAvailablePort(preferred, maxRetries = PORT_RETRY_COUNT) {
    const net = await import('net');
    for (let offset = 0; offset < maxRetries; offset++) {
        const port = preferred + offset;
        const available = await new Promise((resolve) => {
            const tester = net.createServer();
            tester.once('error', (err) => {
                if (err.code === 'EADDRINUSE')
                    resolve(false);
                else
                    resolve(false);
            });
            tester.once('listening', () => {
                tester.close(() => resolve(true));
            });
            tester.listen(port, '127.0.0.1');
        });
        if (available)
            return port;
    }
    throw new Error(`No available port in range ${preferred}-${preferred + maxRetries - 1}`);
}
/** Simple HTTP server wrapping MCP JSON-RPC protocol */
export class HttpTransport {
    server = null;
    handler;
    options;
    constructor(handler, options) {
        this.handler = handler;
        this.options = options;
    }
    /**
     * Start the HTTP server.
     *
     * If the requested port is busy, automatically tries the next port up to
     * PORT_RETRY_COUNT times. Returns the actual port + bind address used.
     */
    async start() {
        const bind = this.options.bind ?? '127.0.0.1';
        const authToken = this.options.authToken;
        const corsOrigins = this.options.corsOrigins ?? [];
        const actualPort = await findAvailablePort(this.options.port);
        const portFallback = actualPort !== this.options.port;
        this.server = http.createServer(async (req, res) => {
            const jsonHeaders = { 'Content-Type': 'application/json' };
            // Health check endpoints (no auth required)
            if (this.options.healthGetter && req.method === 'GET') {
                if (req.url === '/healthz') {
                    const status = healthCheck();
                    res.writeHead(200, jsonHeaders);
                    res.end(JSON.stringify(status));
                    return;
                }
                if (req.url === '/readyz') {
                    const { projectRoot, config } = this.options.healthGetter();
                    const status = readinessCheck(projectRoot, config);
                    res.writeHead(status.ready ? 200 : 503, jsonHeaders);
                    res.end(JSON.stringify(status));
                    return;
                }
            }
            // CORS (D-17): only enable if cors_origins is configured
            const origin = req.headers['origin'];
            if (corsOrigins.length > 0 && origin && req.method === 'OPTIONS') {
                if (corsOrigins.includes(origin)) {
                    this.setCorsHeaders(res, origin);
                    res.writeHead(204);
                    res.end();
                    return;
                }
            }
            // Auth check
            if (authToken) {
                const auth = req.headers['authorization'] ?? '';
                if (auth !== `Bearer ${authToken}`) {
                    res.writeHead(401, jsonHeaders);
                    res.end(JSON.stringify({ error: { code: -32001, message: 'Unauthorized' } }));
                    return;
                }
            }
            // Only accept POST to /mcp
            if (req.method !== 'POST' || req.url !== '/mcp') {
                res.writeHead(404, jsonHeaders);
                res.end(JSON.stringify({ error: { code: -32601, message: 'Not found. POST to /mcp' } }));
                return;
            }
            // Read body
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const request = JSON.parse(body);
                    // Route to handler
                    const response = await this.handler(request);
                    // JSON-RPC 2.0: notifications (no id) MUST NOT receive a response
                    if (response.id === undefined && response.id !== null) {
                        res.writeHead(204);
                        res.end();
                        return;
                    }
                    if (corsOrigins.length > 0 && origin && corsOrigins.includes(origin)) {
                        this.setCorsHeaders(res, origin);
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(response));
                }
                catch {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        jsonrpc: '2.0',
                        id: null,
                        error: { code: -32700, message: 'Parse error' },
                    }));
                }
            });
        });
        return new Promise((resolve, reject) => {
            this.server.once('error', (err) => {
                reject(err);
            });
            this.server.listen(actualPort, bind, () => {
                resolve({ port: actualPort, bind, portFallback });
            });
        });
    }
    /** Stop the server */
    stop() {
        this.server?.close();
    }
    setCorsHeaders(res, origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
}
//# sourceMappingURL=http.js.map