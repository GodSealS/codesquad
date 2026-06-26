/**
 * LLM Provider Base
 *
 * Abstract base class for LLM providers with common utilities.
 */
import type { LLMProvider, LLMRequest, LLMResponse, LLMUsage, ModelConfig, LLMToolDef } from '../types.js';
import type { ApiEndpoint } from '../../../adapters/types.js';
/** Base class for all LLM provider implementations */
export declare abstract class BaseLLMProvider implements LLMProvider {
    abstract readonly providerName: string;
    /** Build HTTP headers from ModelConfig */
    protected buildHeaders(config: ModelConfig, endpoint: ApiEndpoint): Record<string, string>;
    /** Estimate cost from token usage */
    estimateCost(model: string, usage: Pick<LLMUsage, 'prompt_tokens' | 'completion_tokens'>): number;
    /** Build a standard fetch request */
    protected fetchWithRetry(url: string, options: RequestInit, timeoutMs: number): Promise<Response>;
    /** Format generic tool definitions to provider-specific schema */
    abstract formatTools(tools: LLMToolDef[]): unknown[];
    /** Execute an LLM call */
    abstract call(req: LLMRequest, config: ModelConfig, endpoint: ApiEndpoint): Promise<LLMResponse>;
}
//# sourceMappingURL=base.d.ts.map