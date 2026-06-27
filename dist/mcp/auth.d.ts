/**
 * MCP Auth — Token Authentication Utilities
 *
 * Token-based auth for HTTP transport mode.
 * Supports ${ENV_VAR} resolution for auth tokens.
 */
/** Resolve auth token from env var or literal string */
export declare function resolveAuthToken(token: string): string | null;
/** Generate a cryptographically random token (for auto-generation) */
export declare function generateToken(length?: number): string;
/** Save token to Config/ for the caller to read */
export declare function saveTokenFile(projectRoot: string, token: string): void;
/** Read saved token from Config/, if any */
export declare function readSavedToken(projectRoot: string): string | null;
//# sourceMappingURL=auth.d.ts.map