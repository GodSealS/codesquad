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
import type { McpConfig } from '../config.js';
import type { ModelConfig } from '../llm/types.js';
/** Per-provider key resolution result */
export interface ResolvedKey {
    /** The resolved API key (masked if safeDisplay) */
    key: string;
    /** How the key was resolved */
    source: 'caller' | 'models_config' | 'env' | 'default' | 'none';
    /** Whether the resolution succeeded */
    found: boolean;
}
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
export declare function resolveApiKey(provider: string, modelConfig: ModelConfig, mcpConfig: McpConfig): ResolvedKey;
/**
 * Mask an API key for safe display in logs/audit.
 * Shows first 4 and last 4 characters, masks the rest.
 *
 * @param key  - The raw API key
 * @param keep - Number of characters to keep at each end (default: 4)
 * @returns Masked key string
 */
export declare function maskApiKey(key: string, keep?: number): string;
/**
 * Safety: redact API keys from arbitrary content before logging.
 * Scans for common key patterns (sk-..., Bearer ..., etc.)
 *
 * @param text - Content that may contain API keys
 * @returns Sanitized text
 */
export declare function redactKeys(text: string): string;
//# sourceMappingURL=key-resolver.d.ts.map