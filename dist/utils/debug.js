/**
 * Unified Debug Mode
 *
 * Controlled by:
 *   - CODESQUAD_DEBUG=1  environment variable
 *   - codesquad --debug  CLI flag
 *
 * Debug mode affects ONLY:
 *   1. Log verbosity — enables debug/trace-level messages across all logger systems
 *   2. Anomaly detection — enables inline anomaly checks in agent-runner
 *
 * It does NOT affect: permissions, auth, sandboxing, feature toggles, or any
 * other runtime behavior.
 */
let _debugEnabled = process.env.CODESQUAD_DEBUG !== '0';
/** Enable debug mode at runtime (e.g. from --debug CLI flag). */
export function enableDebugMode() {
    _debugEnabled = true;
}
/** Check whether debug mode is currently active. */
export function isDebugMode() {
    return _debugEnabled;
}
//# sourceMappingURL=debug.js.map