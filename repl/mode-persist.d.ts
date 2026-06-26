/**
 * Mode persistence layer.
 *
 * References Claude Code's setSessionBypassPermissionsMode() → save() chain.
 * CodeSquad simplifies: persist mode into the session JSON file directly.
 */
import type { ChatMode } from './mode.js';
import type { Session } from '../chat/session.js';
/**
 * Persist the current mode to the session file.
 * Mirrors Claude Code's setSessionBypassPermissionsMode() + save() chain.
 */
export declare function persistModeToSession(session: Session, newMode: ChatMode): Promise<void>;
/**
 * Restore mode from a session. Returns DEFAULT_MODE if the session
 * is null or has no mode field (backward compatible with old sessions).
 */
export declare function restoreModeFromSession(session: Session | null): ChatMode;
//# sourceMappingURL=mode-persist.d.ts.map