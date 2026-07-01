/**
 * Tool system types — aligned with Claude Code's Tool interface.
 *
 * References:
 *   Claude Code src/Tool.ts (29KB) — Tool interface design
 *   Claude Code src/tools/toolExecution.ts — execution chain
 *
 * Phase 1.0
 */
// ── TOOL_DEFAULTS (fail-closed) ──
const TOOL_DEFAULTS = {
    isEnabled: () => true,
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    isDestructive: () => true,
    validateInput: () => ({ valid: true }),
    checkPermissions: () => ({ behavior: 'allow' }),
    maxResultSizeChars: 20_000,
};
/**
 * Build a complete Tool from a ToolDef.
 * Fills missing methods with fail-closed defaults.
 * Mirrors Claude Code's buildTool() spread pattern.
 */
export function buildTool(def) {
    return {
        ...TOOL_DEFAULTS,
        ...def,
    };
}
/**
 * Parse a permission rule string like "Bash(git *)" or "Read(*.ts)".
 */
export function parsePermissionRule(raw) {
    const match = raw.match(/^(\w+)(?:\((.+)\))?$/);
    if (!match)
        return null;
    const [, toolName, content] = match;
    return {
        toolName: toolName,
        contentPattern: content || undefined,
    };
}
/**
 * Check if a tool invocation matches a permission rule.
 */
export function matchesRule(rule, toolName, toolInput) {
    if (rule.toolName !== toolName)
        return false;
    if (!rule.contentPattern)
        return true;
    // Reject empty contentPattern to prevent bypass
    // (value.startsWith("") is always true, which would match everything)
    if (rule.contentPattern.length === 0)
        return false;
    // Content-specific matching — check first string field
    const value = findPrimaryStringValue(toolInput);
    if (!value)
        return false;
    // Simple glob: * matches anything, otherwise prefix match
    return rule.contentPattern === '*' || value.startsWith(rule.contentPattern.replace(/\*$/, ''));
}
function findPrimaryStringValue(input) {
    if (!input)
        return undefined;
    for (const key of ['command', 'content', 'file_path', 'pattern']) {
        const val = input[key];
        if (typeof val === 'string')
            return val;
    }
    return undefined;
}
//# sourceMappingURL=types.js.map