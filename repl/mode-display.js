/**
 * Mode display utilities for the REPL prompt.
 *
 * References Claude Code's ModeIndicator in PromptInputFooterLeftSide.tsx:
 *   - Default mode (ask) shows nothing.
 *   - Non-default modes show a badge + hint.
 */
import chalk from 'chalk';
import { MODE_CONFIG, isDefaultMode } from './mode.js';
/** Return the mode's emoji symbol. */
export function modeSymbol(mode) {
    return MODE_CONFIG[mode].symbol;
}
/** Return the mode's full title (e.g. "Ask Mode"). */
export function modeTitle(mode) {
    return MODE_CONFIG[mode].title;
}
/** Return the mode's short title (e.g. "Ask"). */
export function modeShortTitle(mode) {
    return MODE_CONFIG[mode].shortTitle;
}
const COLOR_FN = {
    text: chalk.dim,
    planMode: chalk.yellow,
    autoAccept: chalk.green,
    permission: chalk.magenta,
    error: chalk.red,
    warning: chalk.yellow,
};
/**
 * Render the mode badge for the prompt line.
 * Default mode (ask) returns an empty string — matching Claude Code's
 * ModeIndicator behaviour that hides the default.
 *
 * Non-default modes return e.g. "🔧 Craft on".
 */
export function renderModeBadge(mode) {
    if (isDefaultMode(mode))
        return '';
    const cfg = MODE_CONFIG[mode];
    const colorFn = COLOR_FN[cfg.color] ?? chalk.dim;
    return `${cfg.symbol} ${colorFn(cfg.shortTitle)} ${chalk.dim('on')}`;
}
/** Render the keyboard hint for mode cycling. */
export function renderModeHint() {
    return chalk.dim('(shift+tab to cycle)');
}
//# sourceMappingURL=mode-display.js.map