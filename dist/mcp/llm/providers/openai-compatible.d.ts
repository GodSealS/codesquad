/**
 * OpenAI-Compatible Provider
 *
 * Implements the OpenAI Chat Completions API.
 * Also serves as the base for DeepSeek, Kimi, and other OpenAI-compatible endpoints.
 */
import { BaseLLMProvider } from './base.js';
import type { LLMRequest, LLMResponse, LLMToolDef, ModelConfig } from '../types.js';
import type { ApiEndpoint } from '../../../adapters/types.js';
export declare class OpenAICompatibleProvider extends BaseLLMProvider {
    readonly providerName = "openai-compatible";
    /** Safely parse JSON; return empty object on failure instead of throwing */
    private safeParseJson;
    formatTools(tools: LLMToolDef[]): unknown[];
    private formatMessages;
    call(req: LLMRequest, config: ModelConfig, endpoint: ApiEndpoint): Promise<LLMResponse>;
}
//# sourceMappingURL=openai-compatible.d.ts.map