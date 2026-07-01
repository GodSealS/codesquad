/**
 * Dynamic Tool Registry — LRU-based tool pool with auto-eviction.
 *
 * Instead of sending all 24 tools in every request (bloating the API payload),
 * maintain a capped pool of "active" tools.  Tools are promoted on use and
 * evicted when idle.  Evicted tools can be re-registered on demand — the LLM
 * can still discover them via ToolSearch.
 *
 * Architecture:
 *   ┌─ Active Pool (max 12) ──────────────┐
 *   │  Read, Write, Edit, Grep, Glob,     │  ← always-hot tools
 *   │  Bash, Agent, TodoWrite, AskUserQ,  │
 *   │  WebSearch, WebFetch, Skill         │
 *   └─────────────────────────────────────┘
 *   ┌─ Cold Pool (evicted, on-demand) ────┐
 *   │  TaskCreate, TaskGet, TaskList,     │
 *   │  TaskStop, TeamCreate, TeamDelete,  │
 *   │  SendMessage, EnterPlanMode,        │
 *   │  ExitPlanMode, LSP, ToolSearch      │
 *   └─────────────────────────────────────┘
 *
 * Usage: replace `registerTools([...])` with `initDynamicRegistry([...])`.
 */
import type { Tool } from './types.js';
/**
 * Initialise the dynamic tool registry with all available tools.
 * Only ALWAYS_HOT tools are activated immediately; the rest go to cold pool.
 */
export declare function initDynamicRegistry(allTools: Tool[]): void;
/**
 * Record that a tool was used.  Promotes it in the LRU order.
 * If the tool is currently evicted (not in active pool), re-activates it.
 */
export declare function touchTool(toolName: string): void;
/** Get the current pool status for debugging. */
export declare function getPoolStatus(): {
    active: string[];
    cold: string[];
    total: number;
};
/** Force a pool rebuild (for testing). */
export declare function forceSync(): void;
/** Manually activate a specific tool (e.g., after ToolSearch discovery). */
export declare function activateTool(toolName: string): boolean;
/** Tear down the eviction timer (for clean shutdown). */
export declare function shutdownDynamicRegistry(): void;
//# sourceMappingURL=dynamic-registry.d.ts.map