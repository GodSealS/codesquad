/**
 * LLM Client Types
 *
 * Shared types for LLM provider abstraction layer.
 * Supports Anthropic, OpenAI-compatible, DeepSeek, Kimi, and custom endpoints.
 */
import type { ApiEndpoint } from '../../adapters/types.js';
/** Supported built-in providers */
export type BuiltInProvider = 'anthropic' | 'openai' | 'openai-compatible' | 'deepseek' | 'kimi' | 'custom';
/** Model configuration provided by the caller */
export interface ModelConfig {
    provider: BuiltInProvider | string;
    api_key: string;
    model: string;
    base_url?: string;
    max_tokens?: number;
    temperature?: number;
    /** Optional: reference to a models.config.yaml api.source key */
    source?: string;
    /** Additional headers to pass through */
    headers?: Record<string, string>;
}
/** Generic message in a conversation */
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_call_id?: string;
    tool_calls?: LLMToolCall[];
    name?: string;
}
/** Tool definition shared across providers */
export interface LLMToolDef {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
}
/** A tool call request from the LLM */
export interface LLMToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}
/** Token usage returned by the LLM */
export interface LLMUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost_estimate?: number;
}
/** Unified LLM request */
export interface LLMRequest {
    messages: LLMMessage[];
    tools?: LLMToolDef[];
    max_tokens?: number;
    temperature?: number;
    stop_sequences?: string[];
}
/** Unified LLM response */
export interface LLMResponse {
    /** Text content (null if only tool calls) */
    content: string | null;
    /** Tool calls requested by the LLM */
    tool_calls?: LLMToolCall[];
    /** Token usage */
    usage: LLMUsage;
    /** Raw provider response for debugging */
    raw?: unknown;
    /** Which provider was used */
    provider: string;
}
/** Provider base URL defaults (hardcoded per D-15) */
export declare const PROVIDER_DEFAULTS: Record<string, {
    baseUrl: string;
}>;
/** Abstract provider interface */
export interface LLMProvider {
    readonly providerName: string;
    call(req: LLMRequest, config: ModelConfig, endpoint: ApiEndpoint): Promise<LLMResponse>;
    /** Estimate cost from usage data */
    estimateCost(model: string, usage: Pick<LLMUsage, 'prompt_tokens' | 'completion_tokens'>): number;
    /** Convert generic tools to provider-specific format */
    formatTools(tools: LLMToolDef[]): unknown[];
}
//# sourceMappingURL=types.d.ts.map