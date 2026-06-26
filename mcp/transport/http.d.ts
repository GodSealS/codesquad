/**
 * MCP Transport: HTTP (JSON-RPC 2.0 over HTTP POST)
 *
 * Exposes MCP Server as a REST-ish HTTP endpoint for CI/remote use.
 * Supports token-based authentication and health check endpoints.
 *
 * Per D-03: Default bind 127.0.0.1, TLS via reverse proxy.
 */
import type { MCPRequest, MCPResponse } from './types.js';
import type { McpConfig } from '../config.js';
export type HttpRequestHandler = (request: MCPRequest) => Promise<MCPResponse>;
export type HttpHealthGetter = () => {
    projectRoot: string;
    config: McpConfig;
};
export interface HttpServerOptions {
    port: number;
    bind?: string;
    authToken?: string;
    corsOrigins?: string[];
    /** If provided, enables /healthz and /readyz endpoints */
    healthGetter?: HttpHealthGetter;
}
/** Result from starting the HTTP transport */
export interface HttpStartResult {
    port: number;
    bind: string;
    /** True if the requested port was unavailable and a fallback was used */
    portFallback: boolean;
}
/**
 * Find an available port starting from `preferred`, trying up to `maxRetries`
 * consecutive ports. Returns the first port that is not in use.
 * Throws if no port is available in the range.
 */
export declare function findAvailablePort(preferred: number, maxRetries?: number): Promise<number>;
/** Simple HTTP server wrapping MCP JSON-RPC protocol */
export declare class HttpTransport {
    private server;
    private handler;
    private options;
    constructor(handler: HttpRequestHandler, options: HttpServerOptions);
    /**
     * Start the HTTP server.
     *
     * If the requested port is busy, automatically tries the next port up to
     * PORT_RETRY_COUNT times. Returns the actual port + bind address used.
     */
    start(): Promise<HttpStartResult>;
    /** Stop the server */
    stop(): void;
    private setCorsHeaders;
}
//# sourceMappingURL=http.d.ts.map