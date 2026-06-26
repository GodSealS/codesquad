/**
 * Chat mode definitions and state management.
 *
 * Three modes (akin to Claude Code's PermissionMode):
 *   ask   — default, read-only analysis (Claude Code "default")
 *   craft — implementation guidance (Claude Code "bypassPermissions")
 *   plan  — structured plan design (Claude Code "plan")
 *
 * v4 (P2): ModeState uses `wasPlanBefore: boolean` instead of `previousMode`.
 */
export const CHAT_MODES = ['ask', 'craft', 'plan'];
/** Linear cycle: ask → plan → craft → ask (progressive trust escalation, matching Claude Code's external user cycle) */
export const MODE_CYCLE_ORDER = ['ask', 'plan', 'craft'];
export const DEFAULT_MODE = 'ask';
export const MODE_CONFIG = {
    ask: { title: 'Ask Mode', shortTitle: 'Ask', symbol: '🔍', color: 'text' },
    craft: { title: 'Craft Mode', shortTitle: 'Craft', symbol: '🔧', color: 'autoAccept' },
    plan: { title: 'Plan Mode', shortTitle: 'Plan', symbol: '📋', color: 'planMode' },
};
/** Type guard: check if a string is a valid ChatMode. */
export function isValidMode(s) {
    return CHAT_MODES.includes(s);
}
/** Parse a string to ChatMode, returning undefined if invalid. (v3: O2) */
export function parseMode(s) {
    const lower = s.trim().toLowerCase();
    return isValidMode(lower) ? lower : undefined;
}
/** Return the short title from MODE_CONFIG. (v3: O3) */
export function toShortName(mode) {
    return MODE_CONFIG[mode].shortTitle;
}
/** Linear cycle: ask → plan → craft → ask (progressive trust: analyze → design → implement) */
export function getNextMode(current) {
    const idx = MODE_CYCLE_ORDER.indexOf(current);
    return MODE_CYCLE_ORDER[(idx + 1) % MODE_CYCLE_ORDER.length];
}
/** Check if mode is the default (ask). */
export function isDefaultMode(mode) {
    return mode === 'ask';
}
export function createDefaultModeState() {
    return { currentMode: DEFAULT_MODE, wasPlanBefore: false, modeEnteredAt: Date.now() };
}
//# sourceMappingURL=mode.js.map