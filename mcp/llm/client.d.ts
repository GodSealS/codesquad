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
import type { LLMProvider, LLMRequest, LLMResponse, LLMToolDef, ModelConfig } from './types.js';
import type { ApiEndpoint } from '../../adapters/types.js';
import type { McpConfig } from '../config.js';
export declare class LLMClient {
    private providers;
    private circuitBreaker;
    private modelsConfig;
    private mcpConfig;
    private projectRoot;
    constructor(mcpConfig: McpConfig, projectRoot: string);
    /** Register a provider implementation */
    registerProvider(provider: LLMProvider): void;
    /** Get or load models config */
    private getModelsConfig;
    /** Get the built-in base URL for a provider */
    private getBuiltInBaseUrl;
    /** Resolve the API endpoint for a given model config */
    resolveEndpoint(modelConfig: ModelConfig): Promise<ApiEndpoint>;
    /** Call LLM with retry + circuit breaker + fallback chain */
    call(req: LLMRequest, modelConfig: ModelConfig): Promise<LLMResponse>;
    /** Format generic tools for a given provider */
    formatTools(tools: LLMToolDef[], providerName: string): unknown[];
    /** Get circuit breaker stats for debugging */
    getCircuitBreakerState(provider: string): boolean;
}
//# sourceMappingURL=client.d.ts.map