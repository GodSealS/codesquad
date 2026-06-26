/**
 * Keyboard shortcut bindings for the REPL editor.
 *
 * Maps raw keypress events to REPL editing actions.
 * Phase 1.1 — Step 1.1.4 base (keybinds extracted for cleanliness).
 */
/**
 * Interpret a Node.js keypress event and return the corresponding REPL action.
 */
export function resolveKeyAction(str, key, inEditMode) {
    // ── Ctrl+C handling — edit mode vs main mode ──
    if (key.name === 'c' && key.ctrl) {
        return inEditMode ? { type: 'cancel' } : { type: 'none' }; // SIGINT handled by readline
    }
    // ── Ctrl+G → abort edit mode ──
    if (key.name === 'g' && key.ctrl) {
        return inEditMode ? { type: 'cancel' } : { type: 'none' };
    }
    // ── Alt+Enter / Meta+Enter → submit multi-line buffer ──
    if (key.name === 'return' && key.meta) {
        return inEditMode ? { type: 'submit' } : { type: 'newline' };
    }
    // ── Enter in edit mode → newline ──
    if (key.name === 'return' && inEditMode) {
        return { type: 'newline' };
    }
    // ── Shift+Tab → cycle chat mode (v3: only in non-edit mode) ──
    if (key.name === 'tab' && key.shift && !inEditMode) {
        return { type: 'cycleMode' };
    }
    return { type: 'none' };
}
//# sourceMappingURL=keybinds.js.map