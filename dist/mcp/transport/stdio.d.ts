/**
 * MCP Transport: stdio
 *
 * Implements JSON-RPC 2.0 over stdin/stdout for IDE integration.
 * stderr is used for server logging only (not protocol messages).
 */
import type { MCPRequest, MCPResponse, MCPNotification } from './types.js';
export type { MCPRequest, MCPResponse, MCPNotification };
/** Handler for incoming JSON-RPC requests */
export type RequestHandler = (request: MCPRequest) => Promise<MCPResponse>;
/** Handler for incoming notifications */
export type NotificationHandler = (notification: MCPNotification) => void;
/** Stdio transport for MCP Server */
export declare class StdioTransport {
    private requestHandler;
    private notificationHandler;
    private rl;
    private started;
    /** Start listening on stdin */
    start(onRequest: RequestHandler, onNotification?: NotificationHandler): void;
    /** Handle a single request and send response */
    private handleRequest;
    /** Send a JSON-RPC message to stdout */
    send(message: MCPResponse | MCPNotification): void;
    /** Log a message to stderr (not protocol) */
    log(message: string): void;
    /** Stop the transport */
    stop(): void;
    get isRunning(): boolean;
}
//# sourceMappingURL=stdio.d.ts.map