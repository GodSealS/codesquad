/**
 * Anthropic Provider
 *
 * Implements the Anthropic Messages API.
 * Maps generic LLM requests to Anthropic-specific formats.
 */
import { BaseLLMProvider } from './base.js';
import type { LLMRequest, LLMResponse, LLMToolDef, ModelConfig } from '../types.js';
import type { ApiEndpoint } from '../../../adapters/types.js';
export declare class AnthropicProvider extends BaseLLMProvider {
    readonly providerName = "anthropic";
    formatTools(tools: LLMToolDef[]): unknown[];
    private formatMessages;
    call(req: LLMRequest, config: ModelConfig, endpoint: ApiEndpoint): Promise<LLMResponse>;
}
//# sourceMappingURL=anthropic.d.ts.map