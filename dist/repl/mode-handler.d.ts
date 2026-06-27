/**
 * Mode switching command handler.
 *
 * References Claude Code's getNextPermissionMode.ts:
 *   - getNextPermissionMode() for linear cycling
 *   - cyclePermissionMode() for user-triggered cycling
 *
 * v4 (P2): getModeTransitionMessage signature simplified to (wasPlanBefore, to).
 * v4 (P3): confirmCraftMode uses rl.question() to avoid dual-channel conflicts.
 */
import type { Interface } from 'readline';
import type { ChatMode, ModeState } from './mode.js';
export interface ModeCommandResult {
    status: 'ok' | 'invalid' | 'unchanged' | 'confirm-required';
    message: string;
    newMode?: ChatMode;
    needsCraftConfirm?: boolean;
}
export declare function handleModeCommand(args: string, modeState: ModeState, hasCraftConfirmed: boolean): ModeCommandResult;
/** Cycle to the next mode in ask→craft→plan→ask order. */
export declare function cycleMode(currentMode: ChatMode): ChatMode;
/**
 * Get a system-level transition message when entering or leaving a mode.
 * v4 (P2): Only plan enter/exit triggers special system messages.
 */
export declare function getModeTransitionMessage(wasPlanBefore: boolean, to: ChatMode): string;
/**
 * Prompt the user to confirm entering Craft mode.
 * v4 (P3): Uses rl.question() instead of keypress listener to avoid
 * dual-channel conflicts (keypress events competing with readline input).
 */
export declare function confirmCraftMode(rl: Interface): Promise<boolean>;
//# sourceMappingURL=mode-handler.d.ts.map