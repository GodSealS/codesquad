/**
 * EverOS Memory Backend — delegates store/retrieve/brief to evermemos MCP.
 *
 * When evermemos-mcp is configured in settings.json, this backend wraps
 * MCP tool calls (mcp__evermemos__remember, recall, briefing, forget)
 * behind the standard MemoryBackend interface.
 *
 * Returns empty/undefined when MCP tools are unavailable (no fallback to LocalMemoryBackend).
 *
 * Type mapping:
 *   CodeSquad → EverOS/evermemos
 *   user      → profile
 *   feedback  → cases
 *   project   → cases
 *   reference → cases
 *   store()   → mcp__evermemos__remember
 *   retrieve() → mcp__evermemos__recall
 *   brief()   → mcp__evermemos__briefing
 *   delete()  → mcp__evermemos__forget
 *   list()    → mcp__evermemos__fetch_history
 *
 * References:
 *   Idea/tutrue/memory-system-design.md §Phase 2
 */
import type { MemoryBackend, MemoryEntry, MemoryQuery, MemoryResult, SessionBrief } from './manager.js';
/** MCP tool call function signature (injected by caller). */
export type McpToolCallFn = (serverName: string, toolName: string, args: Record<string, unknown>) => Promise<unknown>;
export declare class EverOSMemoryBackend implements MemoryBackend {
    private mcpCall;
    private space;
    private available;
    private consecutiveFailures;
    private lastRetryTime;
    private static readonly MAX_CONSECUTIVE_FAILURES;
    private static readonly RETRY_COOLDOWN_MS;
    constructor(mcpCall: McpToolCallFn, space?: string);
    /** Mark a failure and check if we should disable. */
    private markFailure;
    /** Attempt to re-enable after cooldown period. */
    private tryReEnable;
    /** Check if a transient failure was recovered. */
    private markSuccess;
    store(entry: MemoryEntry): Promise<void>;
    retrieve(query: MemoryQuery): Promise<MemoryResult[]>;
    list(filter?: MemoryQuery): Promise<MemoryEntry[]>;
    delete(id: string): Promise<void>;
    brief(sessionId: string): Promise<SessionBrief>;
    /** Check if this backend is currently functional. */
    isAvailable(): boolean;
}
//# sourceMappingURL=everos-backend.d.ts.map