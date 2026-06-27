/**
 * Permission pipeline — full tool permission checking chain.
 *
 * References:
 *   Claude Code src/utils/permissions/permissions.ts:1158 — hasPermissionsToUseToolInner()
 *
 * Phase 2.3
 */
import { ALL_PERMISSION_MODES } from './mode.js';
import { matchesRule } from '../tools/types.js';
// ── Permission Rules Storage ──
let _allowRules = [];
let _denyRules = [];
let _askRules = [];
let _defaultPermissionMode = 'default';
/** Set permission rules from settings.json or programmatic config. */
export function loadPermissionRules(allow, deny, ask, defaultMode) {
    _allowRules = allow;
    _denyRules = deny;
    _askRules = ask;
    if (defaultMode && ALL_PERMISSION_MODES.includes(defaultMode)) {
        _defaultPermissionMode = defaultMode;
    }
}
/**
 * Append permission rules on top of existing ones.
 * Settings.json rules are appended after built-in defaults.
 */
export function appendPermissionRules(allow, deny, ask) {
    _allowRules.push(...allow);
    _denyRules.push(...deny);
    _askRules.push(...ask);
}
/** Add built-in safe defaults. */
export function loadBuiltinPermissionRules() {
    _allowRules = [
        { toolName: 'Read', behavior: 'allow', source: 'builtin' },
        { toolName: 'Glob', behavior: 'allow', source: 'builtin' },
        { toolName: 'Grep', behavior: 'allow', source: 'builtin' },
        { toolName: 'Bash', contentPattern: 'git status', behavior: 'allow', source: 'builtin' },
        { toolName: 'Bash', contentPattern: 'git diff', behavior: 'allow', source: 'builtin' },
        { toolName: 'Bash', contentPattern: 'git log', behavior: 'allow', source: 'builtin' },
        { toolName: 'Bash', contentPattern: 'git branch', behavior: 'allow', source: 'builtin' },
        { toolName: 'Bash', contentPattern: 'ls ', behavior: 'allow', source: 'builtin' },
        { toolName: 'Bash', contentPattern: 'dir ', behavior: 'allow', source: 'builtin' },
        { toolName: 'Bash', contentPattern: 'echo ', behavior: 'allow', source: 'builtin' },
    ];
    _denyRules = [
        { toolName: 'Bash', contentPattern: 'rm -rf', behavior: 'deny', source: 'builtin' },
        { toolName: 'Bash', contentPattern: 'sudo ', behavior: 'deny', source: 'builtin' },
        { toolName: 'Bash', contentPattern: 'chmod 777', behavior: 'deny', source: 'builtin' },
        { toolName: 'Write', contentPattern: '.env', behavior: 'deny', source: 'builtin' },
        { toolName: 'Edit', contentPattern: '.env', behavior: 'deny', source: 'builtin' },
    ];
    _askRules = [];
    _defaultPermissionMode = 'default';
}
// ── Permission Pipeline ──
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
export function hasPermissionsToUseTool(tool, toolInput, context) {
    const toolName = tool.name;
    const effectiveMode = context.permissionMode;
    // Step 1: Deny rules
    for (const rule of _denyRules) {
        if (matchesRule(rule, toolName, toolInput)) {
            return {
                behavior: 'deny',
                message: rule.contentPattern
                    ? `Denied by rule: ${toolName}(${rule.contentPattern}) [${rule.source}]`
                    : `Denied by rule: ${toolName} [${rule.source}]`,
            };
        }
    }
    // Step 2: Ask rules
    for (const rule of _askRules) {
        if (matchesRule(rule, toolName, toolInput)) {
            return {
                behavior: 'ask',
                message: `Ask by rule: ${toolName}${rule.contentPattern ? `(${rule.contentPattern})` : ''}`,
            };
        }
    }
    // Step 3: Tool-specific checkPermissions
    const toolPermission = tool.checkPermissions(toolInput, context);
    if (toolPermission.behavior === 'deny') {
        return toolPermission;
    }
    // Step 4: bypassPermissions mode — ALLOW everything
    if (effectiveMode === 'bypassPermissions') {
        return { behavior: 'allow' };
    }
    // Step 6: Mode-specific restrictions
    // Plan mode: only read-only tools
    if (effectiveMode === 'plan' && !tool.isReadOnly()) {
        return {
            behavior: 'deny',
            message: `${toolName} is not available in Plan mode. Switch to Craft mode for write operations.`,
        };
    }
    // acceptEdits mode: auto-allow write/edit tools
    if (effectiveMode === 'acceptEdits' && (toolName === 'Write' || toolName === 'Edit')) {
        return { behavior: 'allow' };
    }
    // dontAsk mode: deny instead of asking
    if (effectiveMode === 'dontAsk') {
        // Only deny destructive tools; allow read-only
        return tool.isDestructive()
            ? { behavior: 'deny', message: `${toolName} is not available in Don't Ask mode.` }
            : { behavior: 'allow' };
    }
    // Step 7: Content-specific ask rules (highest priority override)
    for (const rule of _askRules) {
        if (matchesRule(rule, toolName, toolInput)) {
            return {
                behavior: 'ask',
                message: `Ask by rule: ${toolName}(${rule.contentPattern || '*'})`,
            };
        }
    }
    // Default: allow if tool says so, otherwise ask
    return toolPermission.behavior === 'allow'
        ? toolPermission
        : { behavior: 'ask', message: `${toolName} requires confirmation.` };
}
/**
 * Check if a tool is allowed in the current mode.
 * Quick check — doesn't evaluate content-specific rules.
 */
export function isToolAllowedInMode(tool, mode) {
    if (mode === 'plan' && !tool.isReadOnly())
        return false;
    return true;
}
/**
 * Get the effective permission mode for a context.
 */
export function getEffectivePermissionMode(context) {
    return context.permissionMode;
}
//# sourceMappingURL=pipeline.js.map