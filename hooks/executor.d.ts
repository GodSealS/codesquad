/**
 * Hook execution engine — runs hooks at lifecycle events.
 *
 * References:
 *   Claude Code src/utils/hooks.ts — getMatchingHooks, executePreToolHooks, etc.
 *
 * Phase 2.2
 */
import type { HookEventName, HookConfig, HookInput, HookResult, HooksSettings } from './types.js';
/** Load hooks configuration (from AICore/settings.json or programmatic). */
export declare function loadHooksConfig(config: HooksSettings): void;
/** Register a single hook config for an event. */
export declare function registerHook(event: HookEventName, config: HookConfig): void;
/** Reset hook state (called on /clear or new session). */
export declare function resetHookState(): void;
/**
 * Find all hook configs that match an event and optional tool matcher.
 */
export declare function getMatchingHooks(event: HookEventName, toolName?: string): HookConfig[];
/**
 * Execute all hooks matching an event/tool combination.
 * Returns combined result — 'block' beats 'approve' beats 'allow'.
 */
export declare function executeHooks(event: HookEventName, toolName?: string, input?: HookInput): Promise<HookResult>;
/** Execute PreToolUse hooks for a specific tool. Returns 'block' if any hook blocks. */
export declare function executePreToolHooks(toolName: string, input?: HookInput): Promise<HookResult>;
/** Execute PostToolUse hooks after tool success. */
export declare function executePostToolHooks(toolName: string, input?: HookInput): Promise<HookResult>;
/** Execute PostToolUseFailure hooks after tool error. */
export declare function executePostToolUseFailureHooks(toolName: string, input?: HookInput): Promise<HookResult>;
/** Execute SessionStart hooks. */
export declare function executeSessionStartHooks(source?: HookInput['source']): Promise<HookResult>;
/** Execute Stop hooks. */
export declare function executeStopHooks(sessionId?: string): Promise<HookResult>;
export declare function setPendingUserQuestion(pending: boolean, sessionId?: string): boolean;
/** Execute PreCompact hooks. Returns custom instructions if any. */
export declare function executePreCompactHooks(customInstructions?: string): Promise<HookResult>;
/** Execute PostCompact hooks. */
export declare function executePostCompactHooks(): Promise<HookResult>;
/** Execute SubagentStart hooks. */
export declare function executeSubagentStartHooks(agentName: string): Promise<HookResult>;
/** Execute SubagentStop hooks. */
export declare function executeSubagentStopHooks(agentName: string): Promise<HookResult>;
/** Execute PermissionRequest hooks. */
export declare function executePermissionRequestHooks(toolName: string, input?: HookInput): Promise<HookResult>;
//# sourceMappingURL=executor.d.ts.map