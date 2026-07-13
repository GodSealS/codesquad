/**
 * EverOS Bridge — cross-project memory synchronization.
 *
 * Delegates to EverOSMemoryBackend when evermemos-mcp is available.
 * Maintains the existing exportToEverOS/importFromEverOS API signature
 * for backward compatibility.
 *
 * EverOS (https://github.com/EverMind-AI/EverOS) + evermemos-mcp
 * (https://github.com/tt-a1i/evermemos-mcp) provide distributed,
 * cross-project memory with semantic search and automatic reflection.
 *
 * Reference:
 *   Idea/tutrue/memory-system-design.md §Phase 2
 */
import { EverOSMemoryBackend, type McpToolCallFn } from './everos-backend.js';
/**
 * EverOS client configuration.
 * Reads from process.env or Config/everos.config.yaml (future).
 */
export interface EverOSConfig {
    /** EverOS server URL (e.g. http://localhost:8741) */
    serverUrl: string;
    /** API token for authentication */
    apiToken: string;
    /** Project identifier (e.g. repo name) */
    projectId: string;
    /** Enable cross-project memory sync */
    enabled: boolean;
}
/** Check if EverOS is configured and enabled. */
export declare function isEverOSEnabled(): boolean;
/** Set EverOS configuration (called at startup from settings). */
export declare function setEverOSConfig(config: Partial<EverOSConfig>): void;
/**
 * Export project memory to EverOS via evermemos-mcp.
 * Falls back gracefully when MCP tools are unavailable.
 */
export declare function exportToEverOS(_memoryType: 'session' | 'usage' | 'decision', _data: unknown): Promise<boolean>;
/**
 * Import cross-project context from EverOS.
 */
export declare function importFromEverOS(_query: string): Promise<string | null>;
/**
 * Initialize EverOS backend with an MCP tool-call function.
 * Called when evermemos-mcp is discovered during startup.
 */
export declare function initEverOSBackend(mcpCall: McpToolCallFn, space?: string): void;
/**
 * Get the EverOS backend instance (for manager integration).
 */
export declare function getEverOSBackend(): EverOSMemoryBackend | null;
//# sourceMappingURL=everos-bridge.d.ts.map