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
 * Export project memory to EverOS.
 * Stub — returns false until EverOS SDK is integrated.
 */
export declare function exportToEverOS(_memoryType: 'session' | 'usage' | 'decision', _data: unknown): Promise<boolean>;
/**
 * Import cross-project context from EverOS.
 * Stub — returns null until EverOS SDK is integrated.
 */
export declare function importFromEverOS(_query: string): Promise<string | null>;
//# sourceMappingURL=everos-bridge.d.ts.map