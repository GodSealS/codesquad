/**
 * Web Console authentication middleware.
 *
 * Generates a per-session Bearer token on startup and validates
 * incoming requests via Authorization header or cookie.
 *
 * Token lifecycle: generated at process start, ephemeral (not persisted),
 * invalidated on process exit. No external dependency.
 */
import type http from 'http';
/** Generate a cryptographically random Bearer token. */
export declare function generateToken(): string;
/** Set a hardcoded token (for --token CLI option). */
export declare function setToken(token: string): void;
/** The currently active token. */
export declare function getToken(): string | null;
export declare function setAuthEnabled(enabled: boolean): void;
export declare function isAuthEnabled(): boolean;
/** Extract Bearer token from request (header first, then cookie). */
export declare function extractBearer(req: http.IncomingMessage): string | null;
/**
 * Verify the request has a valid Bearer token.
 * Returns 401 response if authentication fails.
 * Returns true if auth passes or is disabled.
 */
export declare function checkAuth(req: http.IncomingMessage, res: http.ServerResponse): boolean;
/**
 * Handle the /login endpoint — validates a token query parameter
 * and sets a session cookie.
 */
export declare function handleLogin(req: http.IncomingMessage, res: http.ServerResponse): boolean;
export declare function tokenDisplay(): string;
//# sourceMappingURL=auth.d.ts.map