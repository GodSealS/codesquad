/**
 * Multi-provider router with automatic fallback chain.
 *
 * Order: primary → fallback_chain (from Config/mcp.config.yaml) → Ollama (last resort)
 *
 * Phase P3.6
 */
import { callLLM } from './client.js';
import { buildRuntimeConfig } from './registry.js';
import { detectOllama, getOllamaRuntimeConfig } from './fallback.js';
import { loadMcpConfig } from '../mcp/config.js';
const circuitBreaker = new Map(); // provider → state
function recordFailure(providerId) {
    circuitBreaker.set(providerId, {
        failCount: (circuitBreaker.get(providerId)?.failCount || 0) + 1,
        lastFailTime: Date.now(),
    });
}
function resetCircuit(providerId) {
    circuitBreaker.delete(providerId);
}
function isCircuitOpen(providerId, mcpConfig) {
    const config = mcpConfig ?? loadMcpConfig(process.cwd());
    const threshold = config.provider.circuit_breaker.failure_threshold;
    const windowMs = (config.provider.circuit_breaker.window_seconds ?? 60) * 1000;
    const state = circuitBreaker.get(providerId);
    if (!state)
        return false;
    // Auto-reset: if the failure window has passed, close the circuit
    if (Date.now() - state.lastFailTime > windowMs) {
        circuitBreaker.delete(providerId);
        return false;
    }
    return state.failCount >= threshold;
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
        if (fb !== primaryProvider && !isCircuitOpen(fb, mcpConfig)) {
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
        if (isCircuitOpen(entry.providerId, mcpConfig))
            continue;
        try {
            const rt = await buildRuntimeConfig(entry.providerId);
            if (!rt)
                continue; // No key configured or provider not found
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