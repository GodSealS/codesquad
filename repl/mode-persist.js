/**
 * Mode persistence layer.
 *
 * References Claude Code's setSessionBypassPermissionsMode() → save() chain.
 * CodeSquad simplifies: persist mode into the session JSON file directly.
 */
import { DEFAULT_MODE } from './mode.js';
import { save } from '../chat/session.js';
/**
 * Persist the current mode to the session file.
 * Mirrors Claude Code's setSessionBypassPermissionsMode() + save() chain.
 */
export async function persistModeToSession(session, newMode) {
    session.mode = newMode;
    await save(session);
}
/**
 * Restore mode from a session. Returns DEFAULT_MODE if the session
 * is null or has no mode field (backward compatible with old sessions).
 */
export function restoreModeFromSession(session) {
    if (!session)
        return DEFAULT_MODE;
    return session.mode ?? DEFAULT_MODE;
}
//# sourceMappingURL=mode-persist.js.map