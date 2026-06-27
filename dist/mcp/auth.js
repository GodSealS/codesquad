/**
 * MCP Auth — Token Authentication Utilities
 *
 * Token-based auth for HTTP transport mode.
 * Supports ${ENV_VAR} resolution for auth tokens.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
/** Resolve auth token from env var or literal string */
export function resolveAuthToken(token) {
    // Support ${ENV_VAR} syntax (already handled in most config loaders)
    const envMatch = token.match(/^\$\{(.+)\}$/);
    if (envMatch && envMatch[1]) {
        const envVar = envMatch[1];
        return process.env[envVar] ?? null;
    }
    return token || null;
}
/** Generate a cryptographically random token (for auto-generation) */
export function generateToken(length = 32) {
    const bytes = randomBytes(Math.ceil(length * 0.75)); // base64url ~1.33 chars per byte
    return 'mcp_' + bytes.toString('base64url').slice(0, length);
}
/** Save token to Config/ for the caller to read */
export function saveTokenFile(projectRoot, token) {
    const dir = join(projectRoot, 'Config');
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(join(dir, 'mcp-token.txt'), token, 'utf-8');
}
/** Read saved token from Config/, if any */
export function readSavedToken(projectRoot) {
    const tokenPath = join(projectRoot, 'Config', 'mcp-token.txt');
    if (!existsSync(tokenPath))
        return null;
    try {
        return readFileSync(tokenPath, 'utf-8').trim();
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=auth.js.map