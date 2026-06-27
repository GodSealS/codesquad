/**
 * env-resolver — Shared ${ENV_VAR} resolution utility
 *
 * Used by both MCP auth (key-resolver) and model-mapping (models.ts)
 * to resolve environment variable references in configuration values.
 *
 * Supports:
 *   - ${VAR_NAME}        — standard env var
 *   - ${VAR_NAME:-default} — env var with fallback
 *   - Literal strings     — returned as-is
 *
 * On Windows, falls back to reading from the registry (HKCU + HKLM)
 * when process.env doesn't contain the variable. This handles the case
 * where env vars are added via System Properties AFTER the parent
 * process started (e.g., IDE terminals with stale env snapshots).
 */
import { execSync } from 'child_process';
const _registryCache = new Map();
/** Read an env var from the Windows registry (one-time per key). */
function readFromRegistry(name) {
    if (process.platform !== 'win32')
        return undefined;
    if (_registryCache.has(name))
        return _registryCache.get(name) ?? undefined;
    try {
        // Try HKCU (user) first
        const result = execSync(`reg query HKCU\\Environment /v ${name} 2>nul`, {
            encoding: 'utf8',
            timeout: 2000,
            windowsHide: true,
        });
        const match = result.match(/\bREG_(?:SZ|EXPAND_SZ)\s+(.+)/);
        if (match?.[1]) {
            const val = match[1].trim();
            _registryCache.set(name, val);
            return val;
        }
    }
    catch {
        // Not in HKCU
    }
    try {
        // Try HKLM (system) — requires admin to read some keys, may fail silently
        const result = execSync(`reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v ${name} 2>nul`, { encoding: 'utf8', timeout: 2000, windowsHide: true });
        const match = result.match(/\bREG_(?:SZ|EXPAND_SZ)\s+(.+)/);
        if (match?.[1]) {
            const val = match[1].trim();
            _registryCache.set(name, val);
            return val;
        }
    }
    catch {
        // Not in HKLM either
    }
    _registryCache.set(name, null);
    return undefined;
}
/**
 * Look up an env var by name, with registry fallback on Windows.
 * Mirrors process.env lookup but also checks the registry when the
 * process env block is stale (e.g. env var added via System Properties
 * after the IDE/parent process had already started).
 */
export function getEnv(name) {
    // Fast path: process.env (also works on all platforms)
    if (process.env[name] !== undefined)
        return process.env[name];
    // Slow path: registry fallback (Windows only, cached per key)
    return readFromRegistry(name);
}
/**
 * Resolve a single value that may contain an ${ENV_VAR} reference.
 *
 * @param value - The raw configuration value (e.g. "${MCP_AUTH_TOKEN}" or "sk-abc123")
 * @returns The resolved value, or null if the env var is not set (and no default)
 */
export function resolveEnvValue(value) {
    if (!value)
        return null;
    // Check for ${VAR:-default} syntax
    const fallbackMatch = value.match(/^\$\{(.+?):-(.+?)\}$/);
    if (fallbackMatch) {
        const envVar = fallbackMatch[1] ?? '';
        const fallback = fallbackMatch[2] ?? '';
        return getEnv(envVar) ?? fallback;
    }
    // Check for ${VAR} syntax
    const envMatch = value.match(/^\$\{(.+?)\}$/);
    if (envMatch && envMatch[1]) {
        return getEnv(envMatch[1]) ?? null;
    }
    // Literal value
    return value;
}
/**
 * Recursively resolve all ${ENV_VAR} references in an object.
 * Walks nested objects and arrays.
 *
 * @param obj - The configuration object
 * @returns A new object with all env vars resolved
 */
export function resolveEnvObject(obj) {
    const resolved = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            resolved[key] = resolveEnvValue(value);
        }
        else if (Array.isArray(value)) {
            resolved[key] = value.map(item => typeof item === 'string' ? resolveEnvValue(item) : item);
        }
        else if (value && typeof value === 'object' && !(value instanceof Date)) {
            resolved[key] = resolveEnvObject(value);
        }
        else {
            resolved[key] = value;
        }
    }
    return resolved;
}
/**
 * Resolve a string that may contain multiple ${ENV_VAR} references inline.
 *
 * Example: "https://${API_HOST}/v1/${API_PATH}" → "https://example.com/v1/chat"
 *
 * @param template - String with embedded ${ENV_VAR} references
 * @returns The resolved string
 */
export function resolveEnvTemplate(template) {
    return template.replace(/\$\{(.+?)(?::-.*?)?\}/g, (_match, envVar) => {
        const resolved = resolveEnvValue(`\$\{${envVar}\}`);
        if (resolved === null) {
            console.warn(`[env-resolver] Unresolved env var: ${envVar}`);
            return '';
        }
        return resolved;
    });
}
/**
 * Check if a value contains an env var reference
 */
export function hasEnvRef(value) {
    return typeof value === 'string' && /\$\{.+?\}/.test(value);
}
//# sourceMappingURL=env-resolver.js.map