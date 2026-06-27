/**
 * LLM Provider registry.
 *
 * Loads built-in and custom providers, resolves API keys
 * with the priority: env var → OS Keyring → CLI arg → prompt.
 * Phase 1.4 — Step 1.4.2.
 */
import type { ProviderConfig, RuntimeProviderConfig } from './provider.js';
export declare function getProvider(id: string): ProviderConfig | undefined;
export declare function listProviders(): ProviderConfig[];
export declare function getModelOwner(modelId: string): ProviderConfig | undefined;
export declare function registerProvider(config: ProviderConfig): void;
export declare function unregisterProvider(id: string): void;
/**
 * Resolve the API key for a provider, following the priority chain:
 *   1. Environment variable (CI/CD)
 *   2. OS Keyring (secure desktop storage)
 *   3. CLI argument
 *   4. models.config.yaml api.sources (resolves ${ENV_VAR} macros)
 *   5. null — caller must prompt
 */
export declare function resolveApiKey(providerId: string, cliArg?: string, 
/** Optional: also match by baseUrl to distinguish same-provider different-platform keys. */
matchBaseUrl?: string): Promise<string | null>;
/**
 * Build a runtime config with resolved API key.
 * The apiKey is never persisted.
 */
export declare function buildRuntimeConfig(providerId: string, cliApiKey?: string, 
/** Optional: match models.config.yaml source by baseUrl for multi-platform disambiguation. */
matchBaseUrl?: string): Promise<RuntimeProviderConfig | null>;
//# sourceMappingURL=registry.d.ts.map