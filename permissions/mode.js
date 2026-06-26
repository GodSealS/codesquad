/**
 * Permission mode definitions — aligned with Claude Code PermissionMode.
 *
 * Phase 2.0
 */
export const ALL_PERMISSION_MODES = [
    'default',
    'acceptEdits',
    'bypassPermissions',
    'plan',
    'dontAsk',
];
export function chatModeToPermissionMode(cm) {
    switch (cm) {
        case 'ask': return 'default';
        case 'craft': return 'bypassPermissions'; // Vibe Coding: full auto, no permission prompts
        case 'plan': return 'plan';
    }
}
export function permissionModeToChatMode(pm) {
    switch (pm) {
        case 'default':
        case 'dontAsk':
            return 'ask';
        case 'acceptEdits':
        case 'bypassPermissions':
            return 'craft';
        case 'plan':
            return 'plan';
    }
}
export const PERMISSION_MODE_CONFIG = {
    default: {
        title: 'Default Mode',
        shortTitle: 'Default',
        symbol: '🔒',
        description: 'Standard permission prompts for file operations.',
    },
    acceptEdits: {
        title: 'Accept Edits',
        shortTitle: 'Craft',
        symbol: '🔧',
        description: 'Auto-accept file edits. Other tools still require confirmation.',
    },
    bypassPermissions: {
        title: 'Bypass Permissions',
        shortTitle: 'Bypass',
        symbol: '⚡',
        description: 'Skip all permission checks. Use with caution.',
    },
    plan: {
        title: 'Plan Mode',
        shortTitle: 'Plan',
        symbol: '📋',
        description: 'Read-only. Output structured plans, no code changes.',
    },
    dontAsk: {
        title: "Don't Ask",
        shortTitle: 'Silent',
        symbol: '🤫',
        description: 'Convert all ask prompts to deny silently.',
    },
};
/** Progressive trust escalation order (external user cycle). */
export const PERMISSION_MODE_CYCLE = [
    'default',
    'plan',
    'acceptEdits',
    'bypassPermissions',
];
export function getNextPermissionMode(current) {
    const idx = PERMISSION_MODE_CYCLE.indexOf(current);
    if (idx === -1)
        return 'default';
    return PERMISSION_MODE_CYCLE[(idx + 1) % PERMISSION_MODE_CYCLE.length];
}
//# sourceMappingURL=mode.js.map