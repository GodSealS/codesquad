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
import { registerTools } from './registry.js';
// ── Config ──
/** Maximum tools in the active pool. */
const MAX_ACTIVE_TOOLS = 12;
/** Hours of inactivity before a tool is considered cold. */
const COLD_THRESHOLD_HOURS = 1;
/** Check interval: how often to run eviction (ms). */
const EVICTION_INTERVAL_MS = 5 * 60_000; // 5 minutes
const _allTools = new Map();
let _evictionTimer = null;
let _toolRegistry;
// ── Always-hot tools (core set, never evicted) ──
const ALWAYS_HOT = new Set([
    'Read', 'Write', 'Edit', 'Grep', 'Glob',
    'Bash', 'Agent', 'TodoWrite', 'AskUserQuestion',
    'WebSearch', 'WebFetch', 'Skill',
]);
// ── Initialisation ──
/**
 * Initialise the dynamic tool registry with all available tools.
 * Only ALWAYS_HOT tools are activated immediately; the rest go to cold pool.
 */
export function initDynamicRegistry(allTools, toolRegistry) {
    _allTools.clear();
    _toolRegistry = toolRegistry;
    for (const tool of allTools) {
        _allTools.set(tool.name, {
            tool,
            lastUsed: 0,
            useCount: 0,
            alwaysHot: ALWAYS_HOT.has(tool.name),
        });
    }
    // Activate always-hot tools
    syncActivePool();
    // Start periodic eviction
    if (_evictionTimer)
        clearInterval(_evictionTimer);
    _evictionTimer = setInterval(evictColdTools, EVICTION_INTERVAL_MS);
    if (_evictionTimer.unref)
        _evictionTimer.unref(); // don't block process exit
}
// ── Pool Sync ──
/** Rebuild the active tool pool from metadata. */
function syncActivePool() {
    const entries = [..._allTools.values()];
    // Sort: always-hot first, then by lastUsed descending
    const sorted = entries.sort((a, b) => {
        if (a.alwaysHot !== b.alwaysHot)
            return a.alwaysHot ? -1 : 1;
        return b.lastUsed - a.lastUsed;
    });
    const active = sorted.slice(0, MAX_ACTIVE_TOOLS).map(e => e.tool);
    if (_toolRegistry) {
        _toolRegistry.registerTools(active);
    }
    else {
        registerTools(active);
    }
}
// ── Touch (called on every tool use) ──
/**
 * Record that a tool was used.  Promotes it in the LRU order.
 * If the tool is currently evicted (not in active pool), re-activates it.
 */
export function touchTool(toolName, toolRegistry) {
    if (toolRegistry)
        _toolRegistry = toolRegistry;
    const meta = _allTools.get(toolName);
    if (!meta)
        return;
    meta.lastUsed = Date.now();
    meta.useCount++;
    // If this tool is not in the active pool, re-sync
    syncActivePool();
}
// ── Eviction ──
/**
 * Periodically evict cold tools from the active pool.
 * A tool is "cold" if it hasn't been used in COLD_THRESHOLD_HOURS
 * and it's not in ALWAYS_HOT.
 */
function evictColdTools() {
    const now = Date.now();
    const coldThreshold = COLD_THRESHOLD_HOURS * 60 * 60 * 1000;
    let evicted = 0;
    for (const [, meta] of _allTools) {
        if (meta.alwaysHot)
            continue;
        if (meta.lastUsed === 0) {
            // Never used — demote
            meta.lastUsed = 0;
            evicted++;
        }
        else if (now - meta.lastUsed > coldThreshold) {
            evicted++;
        }
    }
    if (evicted > 0) {
        syncActivePool();
        console.log(`[DynamicRegistry] Evicted ${evicted} cold tools, pool size: ${MAX_ACTIVE_TOOLS}`);
    }
}
// ── Status / Debug ──
/** Get the current pool status for debugging. */
export function getPoolStatus() {
    const entries = [..._allTools.values()];
    const sorted = entries.sort((a, b) => {
        if (a.alwaysHot !== b.alwaysHot)
            return a.alwaysHot ? -1 : 1;
        return b.lastUsed - a.lastUsed;
    });
    const active = sorted.slice(0, MAX_ACTIVE_TOOLS).map(e => e.tool.name);
    const cold = sorted.slice(MAX_ACTIVE_TOOLS).map(e => e.tool.name);
    return { active, cold, total: entries.length };
}
/** Force a pool rebuild (for testing). */
export function forceSync() {
    syncActivePool();
}
/** Manually activate a specific tool (e.g., after ToolSearch discovery). */
export function activateTool(toolName) {
    const meta = _allTools.get(toolName);
    if (!meta)
        return false;
    meta.lastUsed = Date.now();
    syncActivePool();
    return true;
}
/** Tear down the eviction timer (for clean shutdown). */
export function shutdownDynamicRegistry() {
    if (_evictionTimer) {
        clearInterval(_evictionTimer);
        _evictionTimer = null;
    }
    _allTools.clear();
    _toolRegistry = undefined;
}
//# sourceMappingURL=dynamic-registry.js.map