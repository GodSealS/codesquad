/**
 * LLM Provider configuration interface.
 *
 * Supports Anthropic, OpenAI, and OpenAI-compatible protocols.
 * Phase 1.4 — Step 1.4.1.
 */
export interface ProviderConfig {
    /** Unique identifier, e.g. "anthropic", "openai", "deepseek" */
    id: string;
    /** Display name, e.g. "Anthropic", "OpenAI" */
    name: string;
    /** Wire protocol */
    protocol: 'anthropic' | 'openai' | 'openai-compatible';
    /** API base URL */
    baseUrl: string;
    /** Supported model IDs */
    models: string[];
    /** Default model for this provider */
    defaultModel: string;
    /** Recommended environment variable for API key */
    envVar: string;
    /** Request/response transform hooks */
    transform?: {
        request?: (req: unknown) => unknown;
        response?: (res: unknown) => unknown;
    };
}
/** Provider with a resolved API key (runtime-only, never persisted). */
export interface RuntimeProviderConfig extends ProviderConfig {
    apiKey: string;
}
//# sourceMappingURL=provider.d.ts.map