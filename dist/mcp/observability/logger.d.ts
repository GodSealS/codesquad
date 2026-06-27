/**
 * Structured Logger
 *
 * JSON-formatted logging for MCP Server operations.
 * Supports log levels: trace | debug | info | warn | error.
 * Outputs to stderr (never stdout — stdout is the MCP protocol channel).
 */
import { type McpConfig } from '../config.js';
/** Initialize logger with MCP config (call once at server start) */
export declare function initLogger(config: McpConfig): void;
export declare const logger: {
    trace(message: string, component?: string, data?: Record<string, unknown>): void;
    debug(message: string, component?: string, data?: Record<string, unknown>): void;
    info(message: string, component?: string, data?: Record<string, unknown>): void;
    warn(message: string, component?: string, data?: Record<string, unknown>): void;
    error(message: string, component?: string, error?: unknown, data?: Record<string, unknown>): void;
    /** Log an agent execution start */
    agentStart(agentName: string, turnLimit: number): void;
    /** Log a tool call */
    toolCall(toolName: string, args: Record<string, unknown>, durationMs: number, success: boolean): void;
    /** Log an LLM API call */
    llmCall(provider: string, model: string, usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    }): void;
    /** Log an MCP external server event */
    externalMcp(serverName: string, event: "connect" | "disconnect" | "tool_call" | "error", detail?: string): void;
};
//# sourceMappingURL=logger.d.ts.map