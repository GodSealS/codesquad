/**
 * Session checkpoint — mid-conversation persistence.
 *
 * S02 — Defensive Execution: saves conversation progress every N turns
 * so a crash doesn't lose all messages. Pure function, no side effects
 * beyond calling session.save().
 */
import { save } from './session.js';
import { logDiagnostic } from '../utils/error-logger.js';
// ── Public API ──
/**
 * Save a session checkpoint. Returns true on success, false on failure.
 * Failures are non-fatal — the conversation continues regardless.
 *
 * @param session  The session to persist.
 * @param turn     Current turn number (for diagnostic logging).
 */
export async function saveCheckpoint(session, turn) {
    try {
        const startMs = Date.now();
        await save(session);
        const durationMs = Date.now() - startMs;
        logDiagnostic('DEBUG', 'checkpoint', `saved at turn ${turn} (${durationMs}ms)`, {
            sessionId: session.id,
            messageCount: session.messages.length,
        });
        return true;
    }
    catch (err) {
        logDiagnostic('ERROR', 'checkpoint', `save failed at turn ${turn}: ${err.message}`, {
            sessionId: session.id,
        });
        return false;
    }
}
/**
 * Emergency save — called in the outermost catch of the agent loop.
 * Silently swallows errors so the original exception is not masked.
 */
export async function emergencySave(session) {
    try {
        await save(session);
    }
    catch {
        // Intentionally silent — don't mask the original error
    }
}
//# sourceMappingURL=checkpoint.js.map