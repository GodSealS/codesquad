/**
 * CodeSquad API Server — HTTP bridge between UI and CLI core.
 *
 * Provides REST endpoints for chat, agents, skills, sessions, tools, and MCP.
 * Shares the same Node process and core modules as the REPL.
 *
 * Start:  codesquad --serve [port]
 *         or: await startApiServer(config)
 */
import type { ToolRegistry } from '../tools/ToolRegistry.js';
export interface ApiServerConfig {
    port: number;
    host: string;
    aicoreDir: string;
    projectRoot: string;
    corsOrigins: string[];
    toolRegistry?: ToolRegistry;
}
export interface ApiState {
    providerId: string;
    modelId: string;
}
export declare function setApiState(state: ApiState): void;
export declare function getApiState(): ApiState | null;
export declare function startApiServer(config: ApiServerConfig): Promise<void>;
//# sourceMappingURL=server.d.ts.map