/**
 * Mode display utilities for the REPL prompt.
 *
 * References Claude Code's ModeIndicator in PromptInputFooterLeftSide.tsx:
 *   - Default mode (ask) shows nothing.
 *   - Non-default modes show a badge + hint.
 */
import type { ChatMode } from './mode.js';
/** Return the mode's emoji symbol. */
export declare function modeSymbol(mode: ChatMode): string;
/** Return the mode's full title (e.g. "Ask Mode"). */
export declare function modeTitle(mode: ChatMode): string;
/** Return the mode's short title (e.g. "Ask"). */
export declare function modeShortTitle(mode: ChatMode): string;
/**
 * Render the mode badge for the prompt line.
 * Default mode (ask) returns an empty string — matching Claude Code's
 * ModeIndicator behaviour that hides the default.
 *
 * Non-default modes return e.g. "🔧 Craft on".
 */
export declare function renderModeBadge(mode: ChatMode): string;
/** Render the keyboard hint for mode cycling. */
export declare function renderModeHint(): string;
//# sourceMappingURL=mode-display.d.ts.map