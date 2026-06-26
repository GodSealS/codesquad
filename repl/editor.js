/**
 * Multi-line editor mode for the REPL.
 *
 * When the user types "@agent-name" followed by Enter, the REPL enters
 * multi-line edit mode where Enter inserts a newline and Alt+Enter submits.
 * Phase 1.1 — Step 1.1.3.
 */
import chalk from 'chalk';
const EDIT_PROMPT = chalk.dim('[编辑模式，Enter 换行，Alt+Enter 提交，Ctrl+G 放弃]');
/** Create a new idle editor state. */
export function createEditor() {
    return { active: false, buffer: [], prefix: '' };
}
/** Enter edit mode with the given prefix line (the @agent command). */
export function enterEditMode(editor, prefix) {
    editor.active = true;
    editor.buffer = [];
    editor.prefix = prefix;
}
/** Append a line to the editor buffer. */
export function appendLine(editor, line) {
    editor.buffer.push(line);
}
/** Get the full text to send (prefix + buffer lines joined). */
export function getFullText(editor) {
    const body = editor.buffer.join('\n').trim();
    if (body.length === 0)
        return editor.prefix;
    return `${editor.prefix} ${body}`;
}
/** Cancel edit mode and clear the buffer. */
export function cancelEdit(editor) {
    editor.active = false;
    editor.buffer = [];
    editor.prefix = '';
}
/** Check if editor is in active edit mode. */
export function isInEditMode(editor) {
    return editor.active;
}
/** Get the terminal prompt to display during edit mode. */
export function editPrompt() {
    return `${EDIT_PROMPT}\n  `;
}
/** Get the fallback submit hint when Alt+Enter doesn't work. */
export function getSubmitFallbackHint() {
    return chalk.dim('  (提示: 如果 Alt+Enter 不可用，输入 ') + chalk.yellow('#submit') + chalk.dim(' 提交)');
}
//# sourceMappingURL=editor.js.map