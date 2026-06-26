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
export type ChatMode = 'ask' | 'craft' | 'plan';
export declare const CHAT_MODES: readonly ["ask", "craft", "plan"];
/** Linear cycle: ask → plan → craft → ask (progressive trust escalation, matching Claude Code's external user cycle) */
export declare const MODE_CYCLE_ORDER: readonly ["ask", "plan", "craft"];
export declare const DEFAULT_MODE: ChatMode;
export type ModeColor = 'text' | 'planMode' | 'permission' | 'autoAccept' | 'error' | 'warning';
export interface ModeConfig {
    title: string;
    shortTitle: string;
    symbol: string;
    color: ModeColor;
}
export declare const MODE_CONFIG: Record<ChatMode, ModeConfig>;
/** Type guard: check if a string is a valid ChatMode. */
export declare function isValidMode(s: string): s is ChatMode;
/** Parse a string to ChatMode, returning undefined if invalid. (v3: O2) */
export declare function parseMode(s: string): ChatMode | undefined;
/** Return the short title from MODE_CONFIG. (v3: O3) */
export declare function toShortName(mode: ChatMode): string;
/** Linear cycle: ask → plan → craft → ask (progressive trust: analyze → design → implement) */
export declare function getNextMode(current: ChatMode): ChatMode;
/** Check if mode is the default (ask). */
export declare function isDefaultMode(mode: ChatMode): boolean;
/** v4 (P2): ModeState simplifies previousMode to wasPlanBefore. */
export interface ModeState {
    currentMode: ChatMode;
    wasPlanBefore: boolean;
    modeEnteredAt: number;
}
export declare function createDefaultModeState(): ModeState;
//# sourceMappingURL=mode.d.ts.map