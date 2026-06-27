/**
 * Keyboard shortcut bindings for the REPL editor.
 *
 * Maps raw keypress events to REPL editing actions.
 * Phase 1.1 — Step 1.1.4 base (keybinds extracted for cleanliness).
 */
/** Resolved action for a keypress event. */
export type KeyAction = {
    type: 'submit';
} | {
    type: 'cancel';
} | {
    type: 'newline';
} | {
    type: 'cycleMode';
} | {
    type: 'none';
};
/**
 * Interpret a Node.js keypress event and return the corresponding REPL action.
 */
export declare function resolveKeyAction(str: string, key: {
    name: string;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
}, inEditMode: boolean): KeyAction;
//# sourceMappingURL=keybinds.d.ts.map