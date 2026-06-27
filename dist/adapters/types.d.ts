/**
 * CodeSquad Core Types
 *
 * Tool-agnostic definitions for Agent and Skill content.
 * These types represent the canonical format stored in the CLI package.
 * Adapters translate these into tool-specific frontmatter and paths.
 */
/** Canonical agent definition parsed from agents/<name>.md */
export interface AgentDef {
    /** Agent identifier (e.g., 'game-designer', 'lead-programmer') */
    name: string;
    /** Human-readable description of the agent's role */
    description: string;
    /** Comma-separated list of allowed tools */
    tools: string;
    /** Model identifier (e.g., 'Kimi-K2.6', 'claude-sonnet-4-20250514') */
    model: string;
    /** Maximum conversation turns before auto-stop */
    maxTurns?: number;
    /** Comma-separated list of disallowed tools */
    disallowedTools?: string;
    /** Skill names this agent is authorized to use */
    skills?: string[];
    /** Memory scope ('project' | 'user' | 'none') */
    memory?: string;
    /** Agent execution mode ('agentic' | 'manual') */
    agentMode?: string;
    /** Whether this agent is enabled */
    enabled?: boolean;
    /** Whether this agent can auto-run */
    enabledAutoRun?: boolean;
    /** Thinking depth level: 'fast' | 'think' | 'deep'. Agents default to 'deep'. */
    thinkingLevel?: 'fast' | 'think' | 'deep';
    /** Full body text (system prompt) */
    body: string;
    /** Raw frontmatter parsed extras (for adapter flexibility) */
    extra?: Record<string, unknown>;
}
/** Canonical skill definition parsed from skills/<name>/SKILL.md */
export interface SkillDef {
    /** Skill identifier (e.g., 'start', 'brainstorm', 'gate-check') */
    name: string;
    /** Human-readable description of what the skill does */
    description: string;
    /** Argument hint shown to the user (e.g., '[engine] [version]') */
    argumentHint?: string;
    /** Whether the user can invoke this skill directly */
    userInvocable?: boolean;
    /** Comma-separated list of allowed tools */
    allowedTools?: string;
    /** Model override for this skill */
    model?: string;
    /** Execution context (e.g., 'fork') */
    context?: string;
    /** Full body text (skill instructions) */
    body: string;
    /** Raw frontmatter parsed extras (for adapter flexibility) */
    extra?: Record<string, unknown>;
}
/**
 * Tool adapter interface.
 *
 * Each AI tool (CodeBuddy, Claude Code, Codex, etc.) implements this interface
 * to define where files go and how frontmatter is formatted.
 */
export interface ToolAdapter {
    /** Tool identifier matching AIToolOption.value */
    toolId: string;
    /** Returns the file path for an agent definition */
    getAgentPath(agentId: string): string;
    /** Returns the file path for a skill definition */
    getSkillPath(skillId: string): string;
    /** Returns the file path for the settings file */
    getSettingsPath(): string;
    /** Formats an agent file (frontmatter + body) */
    formatAgent(def: AgentDef, effectiveModel: string): string;
    /** Formats a skill file (frontmatter + body) */
    formatSkill(def: SkillDef, effectiveModel: string): string;
    /** Formats the settings file content */
    formatSettings(agents: AgentDef[], skills: SkillDef[]): string;
    /** Optional: returns the JSON Schema URL for this tool's settings file */
    getSettingsSchemaUrl?(): string | undefined;
    /** Optional: returns tool-specific default model mappings */
    getDefaultModels?(): Partial<ModelsConfig>;
}
/** AI tool descriptor (mirrors OpenSpec's AIToolOption pattern) */
export interface AIToolOption {
    /** Display name */
    name: string;
    /** Value used in --tools flag */
    value: string;
    /** Whether this tool adapter is available */
    available: boolean;
    /** Label shown on success */
    successLabel?: string;
    /** Default directory where skills/commands live (.codebuddy, .claude, etc.) */
    skillsDir?: string;
    /** Paths used for auto-detection (any existing path triggers detection) */
    detectionPaths?: string[];
}
/** Project-level configuration (codesquad.config.yaml) */
export interface ProjectConfig {
    version: number;
    tools: string[];
    engine: {
        name: string;
        version: string;
    };
    generation: {
        overwriteOnUpdate: boolean;
        skipSettings: boolean;
    };
}
/** Model-override: either a plain string or a {model, source} object */
export type ModelOverride = string | {
    model: string;
    source: string;
};
/** API endpoint definition for external model sources */
export interface ApiEndpoint {
    provider?: 'openai-compatible' | 'anthropic' | 'custom';
    baseUrl?: string;
    apiKey?: string;
    headers?: Record<string, string>;
}
/** API sources container */
export interface ApiSources {
    sources: Record<string, ApiEndpoint>;
}
/** Re-export ModelsConfig from the canonical Zod schema to avoid dual-definition */
import type { ModelsConfig } from '../schemas/config.schema.js';
export type { ModelsConfig };
/** Effective model resolution result */
export interface EffectiveModel {
    /** Original model from the agent/skill definition */
    original: string;
    /** Resolved model after applying overrides */
    resolved: string;
    /** Source of the override ('agent' | 'skill' | 'batch' | 'default' | 'original') */
    source: 'agent-override' | 'skill-override' | 'batch' | 'default' | 'original';
    /** Which batch pattern matched (if source === 'batch') */
    batchPattern?: string;
}
/** Result of binding generation */
export interface GenerationResult {
    /** Tool ID */
    toolId: string;
    /** Number of agent files written */
    agentCount: number;
    /** Number of skill files written */
    skillCount: number;
    /** Whether settings file was written */
    settingsWritten: boolean;
    /** Any errors encountered */
    errors: string[];
}
/** Build a partial ModelsConfig with batch mappings and an optional default model */
export declare function buildDefaultModels(batch?: Record<string, string>, defaultModel?: string | null): Partial<ModelsConfig>;
//# sourceMappingURL=types.d.ts.map