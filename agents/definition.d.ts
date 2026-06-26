/**
 * Agent definition system — loads and manages agent configs.
 *
 * Supports three-layer loading: Project > User > AICore.
 *
 * Embedded mode (Bun compile): Layer 1 (AICore built-in) reads from
 * in-memory string constants instead of disk.
 *
 * References:
 *   Claude Code src/tools/AgentTool/loadAgentsDir.ts (26KB)
 *
 * Phase 6.0
 */
import type { PermissionMode } from '../permissions/mode.js';
export interface AgentDefinition {
    /** Unique agent identifier (e.g. "game-designer"). */
    agentType: string;
    /** Human-readable description for parent agent to decide when to use. */
    whenToUse: string;
    /** Full system prompt. */
    prompt: string;
    /** Allowed tools — '*' means all, undefined means wildcard. */
    tools?: string[];
    /** Explicitly disallowed tools. */
    disallowedTools?: string[];
    /** Permission mode override. */
    permissionMode?: PermissionMode;
    /** Maximum turns before auto-stop. */
    maxTurns?: number;
    /** Model override. */
    model?: string;
    /** Run in background (async). */
    background?: boolean;
    /** Prepend text to first user message. */
    initialPrompt?: string;
    /** Whether this agent can be spawned as a subagent via AgentTool. */
    subagent?: boolean;
    /** Source layer: 'user' (AICore/) or 'project' (.codesquad/). */
    layer?: 'user' | 'project';
    /** Source file path. */
    sourcePath?: string;
}
/**
 * Load all agents from a single directory.
 * Parses YAML frontmatter + Markdown body.
 */
export declare function loadAllAgents(agentsDir: string): AgentDefinition[];
/**
 * Load agents from two layers (Project .codesquad/ > User AICore/).
 * Override semantics: same-named agent from project wins.
 *
 * In embedded mode, Layer 1 reads from in-memory constants.
 */
export declare function loadAllAgentsLayered(aicoreRoot: string, cwd?: string): AgentDefinition[];
/** Find an agent by name. */
export declare function findAgent(name: string): AgentDefinition | undefined;
/** List all loaded agents. */
export declare function listAgents(): AgentDefinition[];
/** Invalidate agent cache. */
export declare function invalidateAgentCache(): void;
//# sourceMappingURL=definition.d.ts.map