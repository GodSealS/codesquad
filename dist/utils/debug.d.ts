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
/** Enable debug mode at runtime (e.g. from --debug CLI flag). */
export declare function enableDebugMode(): void;
/** Check whether debug mode is currently active. */
export declare function isDebugMode(): boolean;
//# sourceMappingURL=debug.d.ts.map