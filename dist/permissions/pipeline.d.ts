/**
 * Permission pipeline — full tool permission checking chain.
 *
 * References:
 *   Claude Code src/utils/permissions/permissions.ts:1158 — hasPermissionsToUseToolInner()
 *
 * Phase 2.3
 */
import type { PermissionMode } from './mode.js';
import type { ResolvedPermissionRule, PermissionResult, Tool, ToolUseContext } from '../tools/types.js';
/** Set permission rules from settings.json or programmatic config. */
export declare function loadPermissionRules(allow: ResolvedPermissionRule[], deny: ResolvedPermissionRule[], ask: ResolvedPermissionRule[], defaultMode?: PermissionMode): void;
/**
 * Append permission rules on top of existing ones.
 * Settings.json rules are appended after built-in defaults.
 */
export declare function appendPermissionRules(allow: ResolvedPermissionRule[], deny: ResolvedPermissionRule[], ask: ResolvedPermissionRule[]): void;
/** Add built-in safe defaults. */
export declare function loadBuiltinPermissionRules(): void;
/**
 * Full permission check chain:
 *
 * Step 1: Check deny rules → if matched, RETURN deny
 * Step 2: Check ask rules → if matched, RETURN ask
 * Step 3: Call tool.checkPermissions() → tool-specific check
 * Step 4: Check content-specific deny rules
 * Step 5: Check bypassPermissions → if active, RETURN allow
 * Step 6: Check content-specific ask rules (highest priority override)
 * Step 7: Default → ask (safe-by-default)
 */
export declare function hasPermissionsToUseTool(tool: Tool, toolInput: Record<string, unknown>, context: ToolUseContext): PermissionResult;
/**
 * Check if a tool is allowed in the current mode.
 * Quick check — doesn't evaluate content-specific rules.
 */
export declare function isToolAllowedInMode(tool: Tool, mode: PermissionMode): boolean;
/**
 * Get the effective permission mode for a context.
 */
export declare function getEffectivePermissionMode(context: ToolUseContext): PermissionMode;
//# sourceMappingURL=pipeline.d.ts.map