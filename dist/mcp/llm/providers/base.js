/**
 * LLM Provider Base
 *
 * Abstract base class for LLM providers with common utilities.
 */
/** Cost per 1M tokens (USD) - approximate estimates */
const MODEL_PRICING = {
    // Anthropic
    'claude-sonnet-4-20250514': { input: 3, output: 15 },
    'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
    'claude-3-opus-20240229': { input: 15, output: 75 },
    // OpenAI
    'gpt-4o': { input: 2.5, output: 10 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    // DeepSeek
    'deepseek-chat': { input: 0.27, output: 1.1 },
    'deepseek-reasoner': { input: 0.55, output: 2.19 },
    // Kimi
    'kimi-k2.6': { input: 1, output: 4 },
};
/** Base class for all LLM provider implementations */
export class BaseLLMProvider {
    /** Build HTTP headers from ModelConfig */
    buildHeaders(config, endpoint) {
        return {
            'Content-Type': 'application/json',
            ...(endpoint.headers ?? {}),
            ...(config.headers ?? {}),
        };
    }
    /** Estimate cost from token usage */
    estimateCost(model, usage) {
        const pricing = MODEL_PRICING[model] ?? { input: 1, output: 5 };
        const inputCost = (usage.prompt_tokens / 1_000_000) * pricing.input;
        const outputCost = (usage.completion_tokens / 1_000_000) * pricing.output;
        return Math.round((inputCost + outputCost) * 10000) / 10000;
    }
    /** Build a standard fetch request */
    async fetchWithRetry(url, options, timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            return response;
        }
        finally {
            clearTimeout(timer);
        }
    }
}
//# sourceMappingURL=base.js.map