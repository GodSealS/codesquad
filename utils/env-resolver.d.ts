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
/**
 * Look up an env var by name, with registry fallback on Windows.
 * Mirrors process.env lookup but also checks the registry when the
 * process env block is stale (e.g. env var added via System Properties
 * after the IDE/parent process had already started).
 */
export declare function getEnv(name: string): string | undefined;
/**
 * Resolve a single value that may contain an ${ENV_VAR} reference.
 *
 * @param value - The raw configuration value (e.g. "${MCP_AUTH_TOKEN}" or "sk-abc123")
 * @returns The resolved value, or null if the env var is not set (and no default)
 */
export declare function resolveEnvValue(value: string): string | null;
/**
 * Recursively resolve all ${ENV_VAR} references in an object.
 * Walks nested objects and arrays.
 *
 * @param obj - The configuration object
 * @returns A new object with all env vars resolved
 */
export declare function resolveEnvObject<T extends Record<string, unknown>>(obj: T): T;
/**
 * Resolve a string that may contain multiple ${ENV_VAR} references inline.
 *
 * Example: "https://${API_HOST}/v1/${API_PATH}" → "https://example.com/v1/chat"
 *
 * @param template - String with embedded ${ENV_VAR} references
 * @returns The resolved string
 */
export declare function resolveEnvTemplate(template: string): string;
/**
 * Check if a value contains an env var reference
 */
export declare function hasEnvRef(value: string): boolean;
//# sourceMappingURL=env-resolver.d.ts.map