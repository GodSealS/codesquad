/**
 * EverOS Memory Backend — delegates store/retrieve/brief to evermemos MCP.
 *
 * When evermemos-mcp is configured in settings.json, this backend wraps
 * MCP tool calls (mcp__evermemos__remember, recall, briefing, forget)
 * behind the standard MemoryBackend interface.
 *
 * Falls back to LocalMemoryBackend when MCP tools are unavailable.
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
    constructor(mcpCall: McpToolCallFn, space?: string);
    store(entry: MemoryEntry): Promise<void>;
    retrieve(query: MemoryQuery): Promise<MemoryResult[]>;
    list(filter?: MemoryQuery): Promise<MemoryEntry[]>;
    delete(id: string): Promise<void>;
    brief(sessionId: string): Promise<SessionBrief>;
    /** Check if this backend is currently functional. */
    isAvailable(): boolean;
}
//# sourceMappingURL=everos-backend.d.ts.map