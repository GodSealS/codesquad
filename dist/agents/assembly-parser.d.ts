/**
 * Assembly Parser — parses `.assembly.md` files and merges with parent agents.
 *
 * Assembly files declare inheritance from a base agent via frontmatter,
 * superimposing skills, tools, model overrides, and body content.
 *
 * References:
 *   Idea/tutrue/agent-assembly-design.md §3.2
 *   Idea/tutrue/.out/implementation-plan.md A-Task 2
 */
import type { AgentDef } from '../adapters/types.js';
/** Metadata parsed from an assembly file's YAML frontmatter (without parent body). */
export interface AssemblyMeta {
    /** Assembly agent name (required). */
    name: string;
    /** Human-readable description (required). */
    description: string;
    /** Parent agent name — must exist in agents/ directory (required). */
    agent_parent: string;
    /** Skills to merge with parent (union, dedup). */
    skills?: string[];
    /** Model override. */
    model?: string;
    /** Max turns override. */
    maxTurns?: number;
    /** Tools override (comma-separated). */
    tools?: string;
    /** Disallowed tools to merge with parent (union). */
    disallowedTools?: string;
    /** Memory scope override. */
    memory?: string;
    /** Instance ID for multi-role memory isolation. */
    instanceId?: string;
    /** Body merge mode: 'append' (default) or 'replace'. */
    body_mode: 'append' | 'replace';
    /** Enabled flag (independent of parent). */
    enabled?: boolean;
    /** Auto-run flag. */
    enabledAutoRun?: boolean;
    /** Agent execution mode. */
    agentMode?: string;
    /** Thinking depth level. */
    thinkingLevel?: 'fast' | 'think' | 'deep';
    /** Body content (system prompt addition/replacement). */
    body?: string;
}
/** Options for parseAssemblyFile. */
export interface ParseAssemblyOptions {
    /** Directory where parent agents live (used for circular-reference detection). */
    agentsDir?: string;
}
export declare class AssemblyError extends Error {
    constructor(message: string);
}
/**
 * Parse a `.assembly.md` file's frontmatter (without body).
 * Called at startup for lightweight metadata loading.
 */
export declare function parseAssemblyFile(filePath: string, options?: ParseAssemblyOptions): AssemblyMeta;
/**
 * Merge an AssemblyMeta with its parent AgentDef to produce a complete agent.
 * Called on first use (lazy body loading).
 */
export declare function resolveAssemblyBody(meta: AssemblyMeta, parent: AgentDef): AgentDef;
//# sourceMappingURL=assembly-parser.d.ts.map