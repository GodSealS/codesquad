/**
 * Optional Bearer token authentication middleware.
 * Disabled by default — enable by setting CODESQUAD_API_TOKEN env var.
 */
const API_TOKEN = process.env.CODESQUAD_API_TOKEN;
export function authMiddleware(req, res, next) {
    // Auth disabled by default (local development)
    if (!API_TOKEN) {
        next();
        return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid Authorization header', code: 401 });
        return;
    }
    const token = authHeader.slice(7);
    if (token !== API_TOKEN) {
        res.status(403).json({ error: 'Invalid API token', code: 403 });
        return;
    }
    next();
}
/** Check if auth is enabled. */
export function isAuthEnabled() {
    return !!API_TOKEN;
}
//# sourceMappingURL=auth.js.map