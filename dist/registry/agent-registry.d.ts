/**
 * Agent registry — external registration into AICore/agents/ (user-level).
 */
import type { AgentDef } from '../adapters/types.js';
import type { RegistryEntry, RegisterResult } from './types.js';
/** Scan agents in a directory (.md files, excluding manifest.yaml). */
export declare function scanAgentDir(dir: string): Array<{
    name: string;
    filePath: string;
}>;
/** Parse an agent file. */
export declare function loadAgentFile(filePath: string): AgentDef | null;
/** Register an external agent file to AICore/agents/. */
export declare function registerAgentFile(aicoreRoot: string, sourcePath: string, sourceName: string): {
    name: string;
} | string;
/** Register an entire external agent directory to AICore/agents/. */
export declare function registerAgentDir(aicoreRoot: string, sourceDir: string, sourceName: string): RegisterResult;
/** List registered agents. */
export declare function listRegisteredAgents(aicoreRoot: string): RegistryEntry[];
/** Unregister an agent from AICore/agents/. */
export declare function unregisterAgent(aicoreRoot: string, name: string): boolean;
//# sourceMappingURL=agent-registry.d.ts.map