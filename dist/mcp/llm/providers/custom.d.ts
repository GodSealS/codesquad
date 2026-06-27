/**
 * Custom LLM Provider
 *
 * OpenAI-compatible provider for third-party / self-hosted endpoints.
 * Supports any service that implements OpenAI-compatible chat completions API.
 *
 * Examples: vLLM, Ollama, LocalAI, LiteLLM proxy, self-hosted deployment
 */
import { BaseLLMProvider } from './base.js';
import type { LLMRequest, LLMResponse, ModelConfig, LLMToolDef } from '../types.js';
import type { ApiEndpoint } from '../../../adapters/types.js';
/** Custom provider implementing OpenAI-compatible API */
export declare class CustomProvider extends BaseLLMProvider {
    readonly providerName = "custom";
    call(req: LLMRequest, config: ModelConfig, endpoint: ApiEndpoint): Promise<LLMResponse>;
    /** Format tools to OpenAI-compatible schema */
    formatTools(tools: LLMToolDef[]): unknown[];
    /** Resolve API key from various sources */
    private resolveKey;
}
//# sourceMappingURL=custom.d.ts.map