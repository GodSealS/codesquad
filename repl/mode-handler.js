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
import { parseMode, getNextMode, toShortName, MODE_CONFIG } from './mode.js';
import { renderModeBadge } from './mode-display.js';
import { errorLine, warnLine, okLine, infoLine } from './display.js';
// ── Handle /mode command ──
export function handleModeCommand(args, modeState, hasCraftConfirmed) {
    const target = args.trim();
    if (!target) {
        const badge = renderModeBadge(modeState.currentMode);
        const label = badge || `${MODE_CONFIG[modeState.currentMode].symbol} ${MODE_CONFIG[modeState.currentMode].shortTitle} (默认)`;
        return {
            status: 'unchanged',
            message: infoLine(`当前模式: ${label}`),
        };
    }
    const parsed = parseMode(target);
    if (!parsed) {
        return {
            status: 'invalid',
            message: errorLine(`无效模式: "${target}"。可用: ask | craft | plan`),
        };
    }
    // First-time craft requires confirmation (decision D5)
    if (parsed === 'craft' && !hasCraftConfirmed) {
        return {
            status: 'confirm-required',
            newMode: parsed,
            needsCraftConfirm: true,
            message: warnLine('Craft 模式允许 AI 自由读写文件。确认进入吗？(y/N)'),
        };
    }
    if (parsed === modeState.currentMode) {
        return {
            status: 'unchanged',
            message: infoLine(`已在 ${toShortName(parsed)} 模式`),
        };
    }
    return {
        status: 'ok',
        newMode: parsed,
        message: okLine(`已切换到: ${renderModeBadge(parsed)}`),
    };
}
// ── Cycle mode ──
/** Cycle to the next mode in ask→craft→plan→ask order. */
export function cycleMode(currentMode) {
    return getNextMode(currentMode);
}
// ── Transition message ──
/**
 * Get a system-level transition message when entering or leaving a mode.
 * v4 (P2): Only plan enter/exit triggers special system messages.
 */
export function getModeTransitionMessage(wasPlanBefore, to) {
    if (wasPlanBefore) {
        return '[系统] 已退出 Plan 模式。如果用户批准方案，AI 现在可以输出实现指导。';
    }
    if (to === 'plan') {
        return '[系统] 已进入 Plan 模式。AI 应只输出方案，不提供具体代码实现，等待用户批准。';
    }
    return '';
}
// ── Craft confirmation ──
/**
 * Prompt the user to confirm entering Craft mode.
 * v4 (P3): Uses rl.question() instead of keypress listener to avoid
 * dual-channel conflicts (keypress events competing with readline input).
 */
export function confirmCraftMode(rl) {
    return new Promise((resolve) => {
        rl.question('  ❓ 确认进入 Craft 模式？(y/N) ', (answer) => {
            const s = answer.trim().toLowerCase();
            resolve(s === 'y' || s === 'yes');
        });
    });
}
//# sourceMappingURL=mode-handler.js.map