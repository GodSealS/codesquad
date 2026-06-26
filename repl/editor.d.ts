/**
 * Multi-line editor mode for the REPL.
 *
 * When the user types "@agent-name" followed by Enter, the REPL enters
 * multi-line edit mode where Enter inserts a newline and Alt+Enter submits.
 * Phase 1.1 — Step 1.1.3.
 */
/** State of the multi-line editor. */
export interface EditorState {
    active: boolean;
    buffer: string[];
    /** First line of the input (the @agent command itself). */
    prefix: string;
}
/** Create a new idle editor state. */
export declare function createEditor(): EditorState;
/** Enter edit mode with the given prefix line (the @agent command). */
export declare function enterEditMode(editor: EditorState, prefix: string): void;
/** Append a line to the editor buffer. */
export declare function appendLine(editor: EditorState, line: string): void;
/** Get the full text to send (prefix + buffer lines joined). */
export declare function getFullText(editor: EditorState): string;
/** Cancel edit mode and clear the buffer. */
export declare function cancelEdit(editor: EditorState): void;
/** Check if editor is in active edit mode. */
export declare function isInEditMode(editor: EditorState): boolean;
/** Get the terminal prompt to display during edit mode. */
export declare function editPrompt(): string;
/** Get the fallback submit hint when Alt+Enter doesn't work. */
export declare function getSubmitFallbackHint(): string;
//# sourceMappingURL=editor.d.ts.map