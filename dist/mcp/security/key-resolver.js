/**
 * Key Resolver — API Key Resolution with ${ENV} support
 *
 * Extends basic auth.ts token resolution with:
 *   - Multi-provider key resolution from models.config.yaml
 *   - ${ENV_VAR} expansion with fallback (${VAR:-default})
 *   - Key masking for audit/safe display
 *   - Priority: caller-provided key > models.config.yaml source > env var > default
 *
 * Used by LLM client layer to resolve the actual API key for each provider call.
 */
import { resolveEnvValue } from '../../utils/env-resolver.js';
import { logger } from '../observability/logger.js';
/**
 * Resolve an API key for a specific provider.
 *
 * Resolution order:
 *   1. Caller-provided api_key in model_config
 *   2. models.config.yaml api.sources[provider].headers
 *   3. Environment variable matching provider convention (e.g. ANTHROPIC_API_KEY)
 *   4. mcp.config.yaml provider.default_key
 *
 * @param provider   - The LLM provider name
 * @param modelConfig - The caller's model configuration
 * @param mcpConfig   - The MCP server configuration
 * @returns Resolved API key with source metadata
 */
export function resolveApiKey(provider, modelConfig, mcpConfig) {
    // 1. Caller-provided key (highest priority)
    if (modelConfig.api_key) {
        const resolved = resolveEnvValue(modelConfig.api_key);
        if (resolved) {
            return { key: resolved, source: 'caller', found: true };
        }
    }
    // 1b. Caller-provided headers may contain auth
    if (modelConfig.headers) {
        const authHeader = modelConfig.headers['Authorization']
            ?? modelConfig.headers['authorization'];
        if (authHeader && typeof authHeader === 'string') {
            const token = authHeader.replace(/^Bearer\s+/i, '');
            const resolved = resolveEnvValue(token);
            if (resolved) {
                return { key: resolved, source: 'caller', found: true };
            }
        }
    }
    // 2. models.config.yaml api.sources (routed via LLM client)
    // Handled upstream in LLM client routing; this is a fallback
    // 3. Environment variable by provider convention
    const envVars = PROVIDER_ENV_VARS[provider.toLowerCase()];
    if (envVars) {
        for (const envName of envVars) {
            const envValue = process.env[envName];
            if (envValue) {
                return { key: envValue, source: 'env', found: true };
            }
        }
    }
    // 4. mcp.config.yaml: use provider default routing if configured
    // (No default_key field in current config schema; skip for now)
    logger.warn(`No API key found for provider: ${provider}`, 'key-resolver', {
        provider,
        checkedSources: ['caller', 'env', 'config'],
    });
    return { key: '', source: 'none', found: false };
}
/**
 * Mask an API key for safe display in logs/audit.
 * Shows first 4 and last 4 characters, masks the rest.
 *
 * @param key  - The raw API key
 * @param keep - Number of characters to keep at each end (default: 4)
 * @returns Masked key string
 */
export function maskApiKey(key, keep = 4) {
    if (!key || key.length <= keep * 2 + 3) {
        return '***';
    }
    const prefix = key.slice(0, keep);
    const suffix = key.slice(-keep);
    return `${prefix}${'*'.repeat(Math.min(key.length - keep * 2, 16))}${suffix}`;
}
/**
 * Safety: redact API keys from arbitrary content before logging.
 * Scans for common key patterns (sk-..., Bearer ..., etc.)
 *
 * @param text - Content that may contain API keys
 * @returns Sanitized text
 */
export function redactKeys(text) {
    return text
        // Anthropic keys: sk-ant-...
        .replace(/sk-ant-[a-zA-Z0-9_-]{20,}/g, 'sk-***-REDACTED')
        // OpenAI keys: sk-...
        .replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***-REDACTED')
        // Bearer tokens
        .replace(/Bearer\s+[a-zA-Z0-9_.-]{16,}/gi, 'Bearer ***REDACTED')
        // Generic API key params in JSON
        .replace(/"[^"]*api_key[^"]*"\s*:\s*"[^"]{8,}"/gi, '"api_key":"***REDACTED"');
}
/**
 * Standard environment variable names for common providers.
 * Checked in priority order.
 */
const PROVIDER_ENV_VARS = {
    anthropic: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
    openai: ['OPENAI_API_KEY'],
    'openai-compatible': ['OPENAI_API_KEY'],
    deepseek: ['DEEPSEEK_API_KEY'],
    kimi: ['MOONSHOT_API_KEY', 'KIMI_API_KEY'],
    custom: ['LLM_API_KEY', 'CUSTOM_API_KEY'],
};
//# sourceMappingURL=key-resolver.js.map