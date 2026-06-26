/**
 * API Key serialization guard.
 *
 * Runtime types include apiKey; persisted types strip it.
 * Prevents accidental key leakage into ~/.codesquad/ or session files.
 * Phase 1.4 — Step 1.4.5.
 */
// ── Runtime stripping ──
/**
 * Strip the apiKey field before serialization.
 * Call this before writing any config to disk.
 */
export function stripApiKey(config) {
    const { apiKey, ...persisted } = config;
    return persisted;
}
/**
 * Validate that a serialized object does NOT contain sensitive fields.
 * Returns an array of field names that should not be present.
 */
export function findSensitiveFields(obj) {
    const sensitive = [];
    const sensitiveKeys = ['apiKey', 'api_key', 'apikey', 'secret', 'token', 'password'];
    function walk(value, path) {
        if (value === null || value === undefined)
            return;
        if (typeof value !== 'object')
            return;
        for (const [key, val] of Object.entries(value)) {
            const lower = key.toLowerCase();
            if (sensitiveKeys.some((sk) => lower.includes(sk))) {
                sensitive.push(`${path}.${key}`);
            }
            if (typeof val === 'object' && val !== null) {
                walk(val, `${path}.${key}`);
            }
        }
    }
    walk(obj, '');
    return sensitive;
}
//# sourceMappingURL=config.js.map