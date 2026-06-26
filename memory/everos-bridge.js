/**
 * EverOS Bridge — cross-project memory synchronization stub.
 *
 * EverOS (https://github.com/EverMind-AI/EverOS) is a professional
 * cross-project memory system that persists agent context, decisions,
 * and knowledge across multiple projects via a centralized server.
 *
 * When EverOS is integrated, this module will:
 *   - Export project memory (sessions, usage, decisions) to EverOS
 *   - Import cross-project context from EverOS on session start
 *   - Sync .codesquad/memory/ with EverOS's distributed storage
 *
 * For now, this is a stub. All storage is project-local under
 * <projectRoot>/.codesquad/.
 *
 * Integration plan (future):
 *   Phase 1: Install EverOS server (Docker/dedicated instance)
 *   Phase 2: Implement EverOSClient below with `everos-js` SDK
 *   Phase 3: Wire into codesquadHome() to dual-write local + remote
 *   Phase 4: SessionStart hook reads cross-project context from EverOS
 *
 * Reference: https://github.com/EverMind-AI/EverOS
 */
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
 * Export project memory to EverOS.
 * Stub — returns false until EverOS SDK is integrated.
 */
export async function exportToEverOS(_memoryType, _data) {
    if (!isEverOSEnabled())
        return false;
    // TODO: Implement with everos-js SDK
    //   const client = new EverOSClient(_everosConfig!.serverUrl, _everosConfig!.apiToken);
    //   await client.exportMemory(_everosConfig!.projectId, _memoryType, _data);
    return false;
}
/**
 * Import cross-project context from EverOS.
 * Stub — returns null until EverOS SDK is integrated.
 */
export async function importFromEverOS(_query) {
    if (!isEverOSEnabled())
        return null;
    // TODO: Implement with everos-js SDK
    //   const client = new EverOSClient(_everosConfig!.serverUrl, _everosConfig!.apiToken);
    //   const results = await client.searchMemory(_everosConfig!.projectId, _query);
    //   return formatMemoryResults(results);
    return null;
}
//# sourceMappingURL=everos-bridge.js.map