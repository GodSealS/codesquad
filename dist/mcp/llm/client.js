/**
 * LLM Client — Provider Router + Retry + Circuit Breaker
 *
 * Central LLM invocation layer that:
 * 1. Resolves provider endpoints using models.config.yaml#api.sources
 * 2. Routes requests to correct provider implementation
 * 3. Implements retry with exponential backoff for transient errors
 * 4. Implements circuit breaker for failing providers
 * 5. Supports fallback chain for degraded operation
 */
import { AnthropicProvider } from './providers/anthropic.js';
import { OpenAICompatibleProvider } from './providers/openai-compatible.js';
import { CustomProvider } from './providers/custom.js';
import { loadModelsConfig } from '../../core/models.js';
import { McpErrorCode, mcpError } from '../errors.js';
/** Circuit breaker per provider */
class CircuitBreaker {
    states = new Map();
    config;
    constructor(config) {
        this.config = config;
    }
    getState(provider) {
        let state = this.states.get(provider);
        if (!state) {
            state = { failures: 0, lastFailureTime: 0, open: false };
            this.states.set(provider, state);
        }
        return state;
    }
    /** Check if the circuit is open (requests should be blocked) */
    isOpen(provider) {
        const state = this.getState(provider);
        if (!state.open)
            return false;
        const now = Date.now();
        const openDuration = now - state.lastFailureTime;
        // After window seconds, transition to half-open
        if (openDuration >= this.config.windowSeconds * 1000) {
            state.open = false;
            state.halfOpenTime = now;
            return false;
        }
        return true;
    }
    /** Record a successful request */
    recordSuccess(provider) {
        const state = this.getState(provider);
        state.failures = 0;
        state.open = false;
        state.halfOpenTime = undefined;
    }
    /** Record a failed request */
    recordFailure(provider) {
        const state = this.getState(provider);
        const now = Date.now();
        // Reset counter if outside the window
        if (now - state.lastFailureTime > this.config.windowSeconds * 1000) {
            state.failures = 0;
        }
        state.failures++;
        state.lastFailureTime = now;
        if (state.failures >= this.config.failureThreshold) {
            state.open = true;
        }
    }
}
// ── Retry Logic ──
/** Retry with exponential backoff */
async function withRetry(fn, maxRetries = 3, baseDelayMs = 1000) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            lastError = err;
            if (attempt === maxRetries)
                break;
            const delay = baseDelayMs * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}
// ── LLM Client ──
export class LLMClient {
    providers = new Map();
    circuitBreaker;
    modelsConfig = null;
    mcpConfig;
    projectRoot;
    constructor(mcpConfig, projectRoot) {
        this.mcpConfig = mcpConfig;
        this.projectRoot = projectRoot;
        const cb = mcpConfig.provider.circuit_breaker;
        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: cb?.failure_threshold ?? 5,
            windowSeconds: cb?.window_seconds ?? 60,
        });
        // Register built-in providers
        this.registerProvider(new AnthropicProvider());
        this.registerProvider(new OpenAICompatibleProvider());
        this.registerProvider(new CustomProvider());
    }
    /** Register a provider implementation */
    registerProvider(provider) {
        this.providers.set(provider.providerName, provider);
    }
    /** Get or load models config */
    getModelsConfig() {
        if (!this.modelsConfig) {
            this.modelsConfig = loadModelsConfig(this.projectRoot);
        }
        return this.modelsConfig;
    }
    /** Get the built-in base URL for a provider */
    getBuiltInBaseUrl(provider) {
        const defaults = {
            anthropic: 'https://api.anthropic.com',
            openai: 'https://api.openai.com/v1',
            'openai-compatible': 'https://api.openai.com/v1',
            deepseek: 'https://api.deepseek.com/v1',
            kimi: 'https://api.moonshot.cn/v1',
        };
        return defaults[provider] ?? 'https://api.openai.com/v1';
    }
    /** Resolve the API endpoint for a given model config */
    async resolveEndpoint(modelConfig) {
        const modelsConfig = this.getModelsConfig();
        // 1. Check if provider matches an api.sources entry
        if (modelConfig.provider && modelsConfig.api?.sources) {
            const source = modelsConfig.api.sources[modelConfig.provider];
            if (source)
                return source;
        }
        // 2. Check built-in provider with routing
        const routingModel = this.mcpConfig.provider.routing[modelConfig.provider];
        if (routingModel) {
            return {
                provider: (modelConfig.provider === 'openai-compatible' || modelConfig.provider === 'openai')
                    ? 'openai-compatible'
                    : 'anthropic',
                baseUrl: modelConfig.base_url ?? this.getBuiltInBaseUrl(modelConfig.provider),
                apiKey: modelConfig.api_key,
            };
        }
        // 3. Fallback to default provider
        const defaultProvider = this.mcpConfig.provider.default;
        const defaultRoutingModel = this.mcpConfig.provider.routing[defaultProvider];
        if (defaultRoutingModel) {
            return {
                provider: defaultProvider === 'openai-compatible' || defaultProvider === 'openai' ? 'openai-compatible' : 'anthropic',
                baseUrl: modelConfig.base_url ?? this.getBuiltInBaseUrl(defaultProvider),
                apiKey: modelConfig.api_key,
            };
        }
        // Last resort: assume OpenAI-compatible
        return {
            provider: 'openai-compatible',
            baseUrl: modelConfig.base_url ?? this.getBuiltInBaseUrl('openai-compatible'),
            apiKey: modelConfig.api_key,
        };
    }
    /** Call LLM with retry + circuit breaker + fallback chain */
    async call(req, modelConfig) {
        const fallbackChain = [
            modelConfig.provider,
            ...this.mcpConfig.provider.fallback_chain.filter(p => p !== modelConfig.provider),
        ];
        let lastError;
        for (const providerName of fallbackChain) {
            // Check circuit breaker
            if (this.circuitBreaker.isOpen(providerName)) {
                continue;
            }
            const provider = this.providers.get(providerName);
            if (!provider)
                continue;
            try {
                const endpoint = await this.resolveEndpoint({
                    ...modelConfig,
                    provider: providerName,
                });
                const result = await withRetry(() => provider.call(req, { ...modelConfig, provider: providerName }, endpoint), 3, 1000);
                this.circuitBreaker.recordSuccess(providerName);
                return result;
            }
            catch (err) {
                this.circuitBreaker.recordFailure(providerName);
                lastError = err;
                // Only retry fallback for transient errors
                if (err && typeof err === 'object' && 'data' in err) {
                    const mcpErr = err;
                    const code = mcpErr.data?.errorCode;
                    if (code !== McpErrorCode.LLM_RATE_LIMITED &&
                        code !== McpErrorCode.LLM_TIMEOUT &&
                        code !== McpErrorCode.LLM_AUTH_FAILED) {
                        throw err; // Non-retryable, don't bother with fallback
                    }
                }
            }
        }
        throw (lastError ??
            mcpError(McpErrorCode.INTERNAL_ERROR, 'All LLM providers failed'));
    }
    /** Format generic tools for a given provider */
    formatTools(tools, providerName) {
        const provider = this.providers.get(providerName);
        if (!provider)
            return [];
        return provider.formatTools(tools);
    }
    /** Get circuit breaker stats for debugging */
    getCircuitBreakerState(provider) {
        return this.circuitBreaker.isOpen(provider);
    }
}
//# sourceMappingURL=client.js.map