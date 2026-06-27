/**
 * Terminal display utilities for the CodeSquad REPL.
 *
 * Uses chalk for ANSI color output. Handles banner rendering,
 * agent response streaming, error templates, and loading spinners.
 * Phase 1.1 — Step 1.1.4.
 */
import chalk from 'chalk';
// ── Icon prefixes ──
export const ICON_ERROR = chalk.red('❌');
export const ICON_WARN = chalk.yellow('⚠️');
export const ICON_OK = chalk.green('✅');
export const ICON_INFO = chalk.blue('ℹ️');
// ── Banner ──
/** Render the REPL startup banner. */
export function renderBanner(version) {
    return [
        '',
        chalk.cyan('  ╔══════════════════════════════════════════╗'),
        chalk.cyan(`  ║        ${chalk.bold.yellow('CodeSquad Terminal REPL')}           ║`),
        chalk.cyan('  ║   AI-native game development toolchain   ║'),
        chalk.cyan('  ╚══════════════════════════════════════════╝'),
        '',
        chalk.dim(`  Version: ${version}`),
        '',
    ].join('\n');
}
/** Render the provider/model status line shown after the banner. */
export function renderProviderStatus(provider, model, ollamaDetected) {
    const lines = [];
    if (provider && model) {
        lines.push(`  ${ICON_OK} Provider: ${chalk.green(provider)} (${chalk.bold(model)})`);
    }
    else {
        lines.push(`  ${ICON_WARN} 未配置 Provider — 输入 ${chalk.bold('/provider')} 进行设置`);
    }
    if (ollamaDetected) {
        lines.push(`  ${ICON_INFO} 本地 Ollama 已检测，网络不可用时自动降级`);
    }
    lines.push('');
    return lines.join('\n');
}
/** Render the help text shown on `/help`. */
export function renderHelp() {
    return [
        '',
        chalk.bold('  REPL 命令:'),
        '',
        `  ${chalk.green('@<agent> [输入]')}    调用 Agent 进行对话`,
        `  ${chalk.green('/<skill> [参数]')}    执行一次性 Skill`,
        `  ${chalk.green('/agents [关键词]')}   搜索可用 Agent`,
        `  ${chalk.green('/skills [关键词]')}   搜索可用 Skill`,
        `  ${chalk.green('/sessions')}          列出历史会话`,
        `  ${chalk.green('/resume <id>')}       恢复会话`,
        `  ${chalk.green('/new')}               开始新会话`,
        `  ${chalk.green('/export [id]')}       导出会话为 Markdown`,
        `  ${chalk.green('/delete [n]')}        删除第 n 条消息（调整上下文）`,
        `  ${chalk.green('/ctx add <文件>')}     注入文件上下文`,
        `  ${chalk.green('/ctx tokens')}        查看 Token 用量`,
        `  ${chalk.green('/ctx clear')}          清除注入上下文`,
        `  ${chalk.green('/model <provider/model>')} 切换模型`,
        `  ${chalk.green('/usage')}             查看用量与费用`,
        `  ${chalk.green('/mode [ask|craft|plan]')} 切换对话模式`,
        `  ${chalk.green('/memory-limit [n]')}  设置跨 Chat 记忆追溯数 (2-15，默认 5)`,
        `  ${chalk.green('/tools')}             查看可用工具 (Bash/Read/Write/Edit/Grep/Glob)`,
        `  ${chalk.green('/compact')}           手动压缩对话上下文`,
        `  ${chalk.green('/help')}              显示此帮助`,
        `  ${chalk.green('/quit')}              退出 REPL`,
        '',
        chalk.dim('  Agent 可通过 <tool-call name="ToolName">{"key":"value"}</tool-call> 调用工具。'),
        chalk.dim('  支持子Agent: @agent "send  @explore 搜索代码" 或直接 @explore 探索代码库。'),
        '',
        chalk.dim('  快捷键:'),
        `  ${chalk.dim('Shift+Tab')} 循环切换模式  ${chalk.dim('Ctrl+C 双按')} 退出  ${chalk.dim('Ctrl+G')} 放弃多行编辑  ${chalk.dim('Alt+Enter')} 提交多行`,
        '',
    ].join('\n');
}
// ── Error / warning / info templates ──
export function errorLine(msg) {
    return `${ICON_ERROR} ${chalk.red(msg)}`;
}
export function warnLine(msg) {
    return `${ICON_WARN} ${chalk.yellow(msg)}`;
}
export function okLine(msg) {
    return `${ICON_OK} ${chalk.green(msg)}`;
}
export function infoLine(msg) {
    return `${ICON_INFO} ${chalk.dim(msg)}`;
}
// ── Spinner ──
let spinnerInterval = null;
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
/** Reset spinner state (for test cleanup). */
export function resetSpinnerState() {
    if (spinnerInterval)
        clearInterval(spinnerInterval);
    spinnerInterval = null;
}
/** Start a loading spinner on the current terminal line. */
export function startSpinner(message) {
    stopSpinner();
    let i = 0;
    const safeFrame = spinnerFrames[0] ?? '?';
    process.stdout.write(chalk.yellow(`${safeFrame} ${message}`));
    spinnerInterval = setInterval(() => {
        i = (i + 1) % spinnerFrames.length;
        process.stdout.write(`\r${chalk.yellow(spinnerFrames[i] ?? spinnerFrames[0])} ${message}`);
    }, 80);
}
/** Stop the spinner and clear the line. */
export function stopSpinner() {
    if (spinnerInterval) {
        clearInterval(spinnerInterval);
        spinnerInterval = null;
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
    }
}
// ── Separator ──
export function separator() {
    return chalk.dim('───────────────────────────────────────────');
}
/** Render inline token usage after an agent response. */
export function renderTokenUsage(inputTokens, outputTokens, availableTokens, costUsd) {
    const parts = [
        `输入 ${chalk.yellow(formatTokens(inputTokens))}`,
        `输出 ${chalk.yellow(formatTokens(outputTokens))}`,
        `可用 ${chalk.green(formatTokens(availableTokens))}`,
    ];
    if (costUsd !== undefined) {
        parts.push(`本轮: ${chalk.dim(`~$${costUsd.toFixed(3)}`)}`);
    }
    return `  ${chalk.bold('Tokens:')} ${parts.join(' / ')}`;
}
function formatTokens(n) {
    if (n >= 1000)
        return `${(n / 1000).toFixed(1)}K`;
    return String(n);
}
// ── Fenced code block rendering ──
/**
 * Render response content with syntax-highlighted fenced code blocks.
 * Detects ``` fences and applies a distinct background style to code sections,
 * leaving plain text in the default color.
 */
export function renderFormattedContent(content) {
    const lines = content.split('\n');
    const result = [];
    let inFence = false;
    let fenceLang = '';
    for (const line of lines) {
        const fenceMatch = line.match(/^```(\w*)\s*$/);
        if (fenceMatch) {
            inFence = !inFence;
            if (inFence) {
                fenceLang = fenceMatch[1] || '';
                result.push(chalk.dim('  ┌─' + (fenceLang ? ` ${chalk.cyan(fenceLang)} ` : '──') + '─'.repeat(60)));
            }
            else {
                result.push(chalk.dim('  └' + '─'.repeat(66)));
            }
            continue;
        }
        if (inFence) {
            // Code line: gray background with subtle left border
            result.push(chalk.dim('  │ ') + chalk.gray(line));
        }
        else {
            // Plain text
            if (line.trim()) {
                result.push(chalk.white(line));
            }
            else {
                result.push('');
            }
        }
    }
    return result.join('\n');
}
//# sourceMappingURL=display.js.map