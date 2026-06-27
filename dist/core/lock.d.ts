/**
 * .codesquad.lock state file management.
 *
 * Tracks the current REPL/legacy mode and prevents
 * accidental state conflicts between init and bind operations.
 * Phase 1.8 — Step 1.8.2.
 */
export type LockMode = 'repl' | 'legacy';
export interface AgentLockEntry {
    source: 'repl' | 'init';
    mode: 'memory' | 'full';
    reason?: string;
}
export interface CodesquadLock {
    version: string;
    generatedAt: string;
    mode: LockMode;
    mcpConfigHash: string;
    agents: Record<string, AgentLockEntry>;
}
export declare function createDefaultLock(version: string, mode?: LockMode): CodesquadLock;
export declare function readLock(cwd?: string): Promise<CodesquadLock | null>;
export declare function writeLock(lock: CodesquadLock, cwd?: string): Promise<void>;
export declare function computeMcpConfigHash(mcpConfigPath: string): string;
/**
 * Check before running `codesquad init` — warns if REPL mode is active.
 */
export declare function beforeInit(cwd?: string): Promise<void>;
/**
 * Check before running `codesquad mcp bind` — checks MCP hash.
 */
export declare function beforeBind(mcpConfigPath?: string, cwd?: string): Promise<boolean>;
export declare function setLockMode(mode: LockMode, cwd?: string): Promise<void>;
//# sourceMappingURL=lock.d.ts.map