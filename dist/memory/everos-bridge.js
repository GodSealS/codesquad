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
import { EverOSMemoryBackend } from './everos-backend.js';
let _everosBackend = null;
let _everosConfig = null;
/** Check if EverOS is configured and enabled. */
export function isEverOSEnabled() {
    return _everosConfig?.enabled === true;
}
/** Set EverOS configuration (called at startup from settings). */
export function setEverOSConfig(config) {
    _everosConfig = {
        serverUrl: config.serverUrl || process.env.EVEROS_SERVER_URL || '',
        apiToken: config.apiToken || process.env.EVEROS_API_TOKEN || '',
        projectId: config.projectId || process.env.EVEROS_PROJECT_ID || '',
        enabled: config.enabled ?? false,
    };
}
/**
 * Export project memory to EverOS via evermemos-mcp.
 * Falls back gracefully when MCP tools are unavailable.
 */
export async function exportToEverOS(_memoryType, _data) {
    if (!isEverOSEnabled())
        return false;
    if (!_everosBackend)
        return false;
    try {
        const content = typeof _data === 'string' ? _data : JSON.stringify(_data);
        await _everosBackend.store({
            name: `export-${_memoryType}`,
            description: `Exported ${_memoryType} memory`,
            type: 'reference',
            content,
        });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Import cross-project context from EverOS.
 */
export async function importFromEverOS(_query) {
    if (!isEverOSEnabled())
        return null;
    if (!_everosBackend)
        return null;
    try {
        const results = await _everosBackend.retrieve({ query: _query, limit: 3 });
        return results.map((r) => `## ${r.entry.name}\n${r.entry.content}`).join('\n\n');
    }
    catch {
        return null;
    }
}
/**
 * Initialize EverOS backend with an MCP tool-call function.
 * Called when evermemos-mcp is discovered during startup.
 */
export function initEverOSBackend(mcpCall, space) {
    _everosConfig = {
        serverUrl: 'mcp://evermemos',
        apiToken: '',
        projectId: space ?? 'coding:default',
        enabled: true,
    };
    _everosBackend = new EverOSMemoryBackend(mcpCall, space ?? 'coding:default');
}
/**
 * Get the EverOS backend instance (for manager integration).
 */
export function getEverOSBackend() {
    return _everosBackend;
}
/** Reset singleton state (for tests). */
export function resetEverOSBridge() {
    _everosBackend = null;
    _everosConfig = null;
}
//# sourceMappingURL=everos-bridge.js.map