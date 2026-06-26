/**
 * Multi-provider router with automatic fallback chain.
 *
 * Order: primary → fallback_chain (from Config/mcp.config.yaml) → Ollama (last resort)
 *
 * Phase P3.6
 */
import { callLLM } from './client.js';
import { buildRuntimeConfig, resolveApiKey } from './registry.js';
import { detectOllama, getOllamaRuntimeConfig } from './fallback.js';
import { loadMcpConfig } from '../mcp/config.js';
// ── Circuit breaker ──
const circuitBreaker = new Map(); // provider → failCount
function recordFailure(providerId) {
    circuitBreaker.set(providerId, (circuitBreaker.get(providerId) || 0) + 1);
}
function resetCircuit(providerId) {
    circuitBreaker.delete(providerId);
}
function isCircuitOpen(providerId) {
    const mcpConfig = loadMcpConfig(process.cwd());
    const threshold = mcpConfig.provider.circuit_breaker.failure_threshold;
    return (circuitBreaker.get(providerId) || 0) >= threshold;
}
// ── Router ──
/**
 * Call LLM with automatic fallback across configured providers.
 *
 * Chain: primary → fallback providers (from Config/mcp.config.yaml) → Ollama
 * Skips providers with open circuit breakers or missing API keys.
 */
export async function callWithFallback(request, primaryProvider, primaryModel, projectRoot) {
    const root = projectRoot || process.cwd();
    const mcpConfig = loadMcpConfig(root);
    // 1. Build provider chain: primary first, then fallback_chain
    const chain = [
        { providerId: primaryProvider, model: primaryModel },
    ];
    for (const fb of mcpConfig.provider.fallback_chain) {
        if (fb !== primaryProvider && !isCircuitOpen(fb)) {
            chain.push({
                providerId: fb,
                model: mcpConfig.provider.routing[fb] || primaryModel,
            });
        }
    }
    // 2. Try each provider in order
    let lastError = null;
    for (let i = 0; i < chain.length; i++) {
        const entry = chain[i];
        // Skip if circuit breaker open
        if (isCircuitOpen(entry.providerId))
            continue;
        try {
            const key = await resolveApiKey(entry.providerId);
            if (!key)
                continue; // No key configured, skip
            const rt = await buildRuntimeConfig(entry.providerId);
            if (!rt)
                continue;
            const response = await callLLM(rt, { ...request, model: entry.model });
            resetCircuit(entry.providerId);
            return { ...response, routedVia: entry.providerId };
        }
        catch (err) {
            lastError = err;
            recordFailure(entry.providerId);
            continue;
        }
    }
    // 3. Ollama as last resort
    if (await detectOllama()) {
        try {
            const rt = await getOllamaRuntimeConfig();
            if (rt?.apiKey) {
                const response = await callLLM(rt, { ...request, model: 'llama3.1' });
                return { ...response, routedVia: 'ollama' };
            }
        }
        catch {
            // Ollama also failed
        }
    }
    throw lastError || new Error('All providers failed — check API keys and network');
}
/**
 * Format a human-readable fallback chain description.
 */
export function getFallbackChainDescription(primaryProvider, projectRoot) {
    const root = projectRoot || process.cwd();
    const mcpConfig = loadMcpConfig(root);
    const chain = [primaryProvider, ...mcpConfig.provider.fallback_chain.filter((p) => p !== primaryProvider)];
    // Always show Ollama as final fallback
    chain.push('ollama (local)');
    return chain.join(' → ');
}
//# sourceMappingURL=router.js.map