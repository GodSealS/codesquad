/**
 * Multi-provider router with automatic fallback chain.
 *
 * Order: primary → fallback_chain (from Config/mcp.config.yaml)
 *
 * Phase P3.6
 */
import { callLLM } from './client.js';
import { buildRuntimeConfig } from './registry.js';
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
 * Chain: primary → fallback providers (from Config/mcp.config.yaml)
 * Skips providers with open circuit breakers or missing API keys.
 *
 * NOTE: No automatic local-model fallback. If all providers fail,
 * the caller receives an error and should prompt the user to configure
 * a local model via the settings panel.
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
    // All providers exhausted — prompt user to configure a local model
    const hintMsg = 'All configured providers failed.\n'
        + '  → To use a local model, configure the "ollama" provider in Config/mcp.config.yaml\n'
        + '  → Or download a local model (Qwen2.5 / Nanbeige4.2) via the Web Console Settings panel.';
    console.error(hintMsg);
    throw lastError || new Error(hintMsg);
}
/**
 * Format a human-readable fallback chain description.
 */
export function getFallbackChainDescription(primaryProvider, projectRoot) {
    const root = projectRoot || process.cwd();
    const mcpConfig = loadMcpConfig(root);
    const chain = [primaryProvider, ...mcpConfig.provider.fallback_chain.filter((p) => p !== primaryProvider)];
    return chain.join(' → ');
}
//# sourceMappingURL=router.js.map