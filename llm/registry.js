/**
 * LLM Provider registry.
 *
 * Loads built-in and custom providers, resolves API keys
 * with the priority: env var → OS Keyring → CLI arg → prompt.
 * Phase 1.4 — Step 1.4.2.
 */
import { BUILTIN_PROVIDERS } from './builtin.js';
import { getKey } from './keyring.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { resolveEnvValue } from '../utils/env-resolver.js';
// ── Registry state ──
let providers = [...BUILTIN_PROVIDERS];
// ── Query ──
export function getProvider(id) {
    return providers.find((p) => p.id === id);
}
export function listProviders() {
    return [...providers];
}
export function getModelOwner(modelId) {
    return providers.find((p) => p.models.includes(modelId));
}
// ── Custom providers ──
export function registerProvider(config) {
    const existing = providers.findIndex((p) => p.id === config.id);
    if (existing >= 0) {
        providers[existing] = config;
    }
    else {
        providers.push(config);
    }
}
export function unregisterProvider(id) {
    providers = providers.filter((p) => p.id !== id);
}
// ── API Key resolution ──
/**
 * Resolve the API key for a provider, following the priority chain:
 *   1. Environment variable (CI/CD)
 *   2. OS Keyring (secure desktop storage)
 *   3. CLI argument
 *   4. models.config.yaml api.sources (resolves ${ENV_VAR} macros)
 *   5. null — caller must prompt
 */
export async function resolveApiKey(providerId, cliArg, 
/** Optional: also match by baseUrl to distinguish same-provider different-platform keys. */
matchBaseUrl) {
    const provider = getProvider(providerId);
    if (!provider)
        return null;
    // 1. Environment variable
    if (provider.envVar) {
        const envVal = process.env[provider.envVar];
        if (envVal)
            return envVal;
    }
    // 2. OS Keyring
    try {
        const keyringVal = await getKey(providerId);
        if (keyringVal)
            return keyringVal;
    }
    catch {
        // Keyring not available — continue to next source
    }
    // 3. CLI argument
    if (cliArg)
        return cliArg;
    // 4. models.config.yaml api.sources
    //    Two-phase match:
    //    a) Exact: provider + baseUrl match (distinguishes Tencent Cloud vs DeepSeek official)
    //    b) Loose: provider match only (fallback, used by auto-detection)
    try {
        const configPath = join(process.cwd(), 'models.config.yaml');
        if (existsSync(configPath)) {
            const { parse } = await import('yaml');
            const raw = readFileSync(configPath, 'utf-8');
            const config = parse(raw);
            const sources = config?.api?.sources ?? {};
            // Phase a: exact match (provider + baseUrl)
            if (matchBaseUrl) {
                for (const [_sourceKey, src] of Object.entries(sources)) {
                    if (src.provider === providerId && src.baseUrl === matchBaseUrl && src.apiKey) {
                        const resolved = resolveEnvValue(src.apiKey);
                        if (resolved)
                            return resolved;
                    }
                }
            }
            // Phase b: loose match (provider only)
            for (const [_sourceKey, src] of Object.entries(sources)) {
                if (src.provider === providerId && src.apiKey) {
                    const resolved = resolveEnvValue(src.apiKey);
                    if (resolved)
                        return resolved;
                }
            }
        }
    }
    catch {
        // Config file missing or invalid — continue to next source
    }
    // 5. No key found
    return null;
}
/**
 * Build a runtime config with resolved API key.
 * The apiKey is never persisted.
 */
export async function buildRuntimeConfig(providerId, cliApiKey, 
/** Optional: match models.config.yaml source by baseUrl for multi-platform disambiguation. */
matchBaseUrl) {
    const provider = getProvider(providerId);
    if (!provider)
        return null;
    const apiKey = await resolveApiKey(providerId, cliApiKey, matchBaseUrl);
    if (!apiKey)
        return null;
    return { ...provider, apiKey };
}
//# sourceMappingURL=registry.js.map