/**
 * Session checkpoint — mid-conversation persistence.
 *
 * S02 — Defensive Execution: saves conversation progress every N turns
 * so a crash doesn't lose all messages. Pure function, no side effects
 * beyond calling session.save().
 */
import type { Session } from './session.js';
/**
 * Save a session checkpoint. Returns true on success, false on failure.
 * Failures are non-fatal — the conversation continues regardless.
 *
 * @param session  The session to persist.
 * @param turn     Current turn number (for diagnostic logging).
 */
export declare function saveCheckpoint(session: Session, turn: number): Promise<boolean>;
/**
 * Emergency save — called in the outermost catch of the agent loop.
 * Silently swallows errors so the original exception is not masked.
 */
export declare function emergencySave(session: Session): Promise<void>;
//# sourceMappingURL=checkpoint.d.ts.map