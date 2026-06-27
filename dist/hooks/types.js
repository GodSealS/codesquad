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
// ── Hook Events ──
export const HOOK_EVENTS = [
    'PreToolUse',
    'PostToolUse',
    'PostToolUseFailure',
    'Notification',
    'UserPromptSubmit',
    'SessionStart',
    'Stop',
    'SubagentStart',
    'SubagentStop',
    'PreCompact',
    'PostCompact',
    'PermissionRequest',
];
// ── Defaults ──
export const DEFAULT_HOOK_TIMEOUT = {
    command: 10,
    prompt: 30,
    agent: 60,
};
export const DEFAULT_COMMAND_SHELL = process.platform === 'win32' ? 'powershell' : 'bash';
//# sourceMappingURL=types.js.map