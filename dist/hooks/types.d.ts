/**
 * Hook types and event definitions — aligned with Claude Code hooks system.
 *
 * References:
 *   Claude Code src/schemas/hooks.ts — hook schema definitions
 *   Claude Code src/utils/hooks.ts (5023 lines) — hook execution patterns
 *
 * Supports 3 hook types: command, prompt, agent
 * 13 hook events covering full agent lifecycle.
 *
 * Phase 2.1
 */
export type HookType = 'command' | 'prompt' | 'agent';
export interface CommandHook {
    type: 'command';
    command: string;
    timeout?: number;
    shell?: string;
}
export interface PromptHook {
    type: 'prompt';
    prompt: string;
    model?: string;
    timeout?: number;
}
export interface AgentHook {
    type: 'agent';
    prompt: string;
    model?: string;
    timeout?: number;
}
export type Hook = CommandHook | PromptHook | AgentHook;
export interface HookConfig {
    /** Tool name matcher (e.g. "Bash", "Write|Edit", "" for all). */
    matcher: string;
    hooks: Array<Hook & {
        /** Condition filter using permission rule syntax. */
        if?: string;
        /** Run only once then auto-remove. */
        once?: boolean;
        /** Whether this hook can be async (don't block the operation). */
        async?: boolean;
        /** Timeout override in seconds. */
        timeout?: number;
    }>;
}
/** Full hooks settings — keyed by event name. */
export type HooksSettings = Partial<Record<HookEventName, HookConfig[]>>;
export declare const HOOK_EVENTS: readonly ["PreToolUse", "PostToolUse", "PostToolUseFailure", "Notification", "UserPromptSubmit", "SessionStart", "Stop", "SubagentStart", "SubagentStop", "PreCompact", "PostCompact", "PermissionRequest"];
export type HookEventName = (typeof HOOK_EVENTS)[number];
export interface HookInput {
    /** Name of the tool being called (for PreToolUse/PostToolUse). */
    tool_name?: string;
    /** Raw tool input arguments. */
    tool_input?: Record<string, unknown>;
    /** Session ID. */
    session_id?: string;
    /** Agent name. */
    agent_name?: string;
    /** Custom instructions (e.g. from compact). */
    custom_instructions?: string;
    /** Source that triggered the hook. */
    source?: 'startup' | 'resume' | 'clear' | 'compact' | 'tool' | 'stop' | 'user';
    /** ISO timestamp of the event. */
    timestamp?: string;
    /** Command being run (for Bash tool hooks). */
    command?: string;
}
export type HookDecision = 'allow' | 'block' | 'approve';
export interface HookResult {
    /** Decision made by the hook. */
    decision?: HookDecision;
    /** Human-readable reason for the decision. */
    reason?: string;
    /** Messages to display to the user. */
    userMessage?: string;
    /** Custom instructions to inject (e.g. PreCompact hooks inject context). */
    newCustomInstructions?: string;
    /** Whether to suppress standard output/error from display. */
    suppressOutput?: boolean;
    /** Exit code from the hook process. */
    exitCode?: number;
    /** Standard output captured. */
    stdout?: string;
    /** Standard error captured. */
    stderr?: string;
    /** Whether the hook was actually available and executed. */
    available: boolean;
    /** Error if hook execution failed. */
    error?: string;
}
export declare const DEFAULT_HOOK_TIMEOUT: {
    readonly command: 10;
    readonly prompt: 30;
    readonly agent: 60;
};
export declare const DEFAULT_COMMAND_SHELL: string;
//# sourceMappingURL=types.d.ts.map