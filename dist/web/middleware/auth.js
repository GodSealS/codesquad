/**
 * Web Console authentication middleware.
 *
 * Generates a per-session Bearer token on startup and validates
 * incoming requests via Authorization header or cookie.
 *
 * Token lifecycle: generated at process start, ephemeral (not persisted),
 * invalidated on process exit. No external dependency.
 */
import { randomBytes } from 'crypto';
const TOKEN_PREFIX = 'csqt_';
const COOKIE_NAME = 'codesquad_token';
// ═══════════════════════════════════════════════════════════════════
// Token management
// ═══════════════════════════════════════════════════════════════════
let _generatedToken = null;
/** Generate a cryptographically random Bearer token. */
export function generateToken() {
    _generatedToken = TOKEN_PREFIX + randomBytes(24).toString('hex');
    return _generatedToken;
}
/** Set a hardcoded token (for --token CLI option). */
export function setToken(token) {
    _generatedToken = token;
}
/** The currently active token. */
export function getToken() {
    return _generatedToken;
}
/** Whether auth is currently enforcing. */
let _authEnabled = true;
export function setAuthEnabled(enabled) {
    _authEnabled = enabled;
}
export function isAuthEnabled() {
    return _authEnabled;
}
// ═══════════════════════════════════════════════════════════════════
// Token extraction
// ═══════════════════════════════════════════════════════════════════
/** Parse Bearer token from Authorization header. */
function bearerFromHeader(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer '))
        return null;
    return auth.slice(7).trim();
}
/** Parse token from cookie. */
function bearerFromCookie(req) {
    const cookie = req.headers.cookie;
    if (!cookie)
        return null;
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
    return match ? match[1].trim() : null;
}
/** Extract Bearer token from request (header first, then cookie). */
export function extractBearer(req) {
    return bearerFromHeader(req) ?? bearerFromCookie(req);
}
// ═══════════════════════════════════════════════════════════════════
// Middleware
// ═══════════════════════════════════════════════════════════════════
/**
 * Verify the request has a valid Bearer token.
 * Returns 401 response if authentication fails.
 * Returns true if auth passes or is disabled.
 */
export function checkAuth(req, res) {
    if (!_authEnabled)
        return true;
    const token = extractBearer(req);
    if (!token || !_generatedToken || token !== _generatedToken) {
        res.writeHead(401, {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer realm="codesquad-web"',
        });
        res.end(JSON.stringify({ error: 'Unauthorized', code: 401 }));
        return false;
    }
    return true;
}
/**
 * Handle the /login endpoint — validates a token query parameter
 * and sets a session cookie.
 */
export function handleLogin(req, res) {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const token = url.searchParams.get('token');
    if (!token || token !== _generatedToken) {
        res.writeHead(401, { 'Content-Type': 'text/html' });
        res.end('<h1>Invalid token</h1>');
        return true;
    }
    const cookieValue = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`;
    res.writeHead(302, {
        Location: '/',
        'Set-Cookie': cookieValue,
    });
    res.end();
    return true;
}
// ═══════════════════════════════════════════════════════════════════
// Token hash (for display)
// ═══════════════════════════════════════════════════════════════════
export function tokenDisplay() {
    if (!_generatedToken)
        return '(none)';
    return _generatedToken.slice(0, 8) + '...' + _generatedToken.slice(-8);
}
//# sourceMappingURL=auth.js.map