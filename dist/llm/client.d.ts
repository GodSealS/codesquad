/**
 * Generic LLM API client.
 *
 * Routes requests through the appropriate provider protocol
 * (Anthropic native, OpenAI, or OpenAI-compatible).
 * Phase 1.4 — Step 1.4.1 base.
 */
import type { RuntimeProviderConfig } from './provider.js';
import type { Message } from '../chat/session.js';
/** Thinking mode: controls extended reasoning / chain-of-thought. */
export type ThinkingMode = 'fast' | 'think' | 'deep';
export interface LlmRequest {
    model: string;
    messages: Message[];
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
    /** Thinking mode: fast (no reasoning), think (medium), deep (extended). */
    thinkingMode?: ThinkingMode;
    /** Anthropic/OpenAI native tool definitions (Feature 1: P4 Tool Use). */
    tools?: Array<{
        name: string;
        description: string;
        input_schema: Record<string, unknown>;
    }>;
    /** Tool choice mode (Feature 1: P4 Tool Use). */
    tool_choice?: {
        type: 'auto' | 'any' | 'tool';
        name?: string;
    };
    /** Feature 4 (P4): Structured system prompt with cache_control support. */
    systemContentBlocks?: Array<{
        type: 'text';
        text: string;
        cache_control?: {
            type: 'ephemeral';
        };
    }>;
    /** Defensive execution: abort signal for timeout/cancellation (S01). */
    signal?: AbortSignal;
}
export interface LlmResponse {
    content: string;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        /** Cache tokens saved (Anthropic prompt caching). Feature 4/Feature 8 (P4). */
        cacheCreationTokens?: number;
        cacheReadTokens?: number;
    };
    /** Native tool_use blocks (Feature 1: P4 Tool Use). */
    toolCalls?: Array<{
        id: string;
        name: string;
        input: Record<string, unknown>;
    }>;
}
export declare class LlmError extends Error {
    status: number;
    providerId: string;
    /** Raw error response body (for upstream error classification). */
    errorBody?: string | undefined;
    constructor(message: string, status: number, providerId: string, 
    /** Raw error response body (for upstream error classification). */
    errorBody?: string | undefined);
    /** Check if this 502 is an upstream (backend model provider) error vs proxy error. */
    isUpstreamError(): boolean;
}
export declare function callLLM(provider: RuntimeProviderConfig, request: LlmRequest): Promise<LlmResponse>;
export interface StreamEvent {
    type: 'token' | 'thinking' | 'done' | 'error';
    /** Accumulated text so far (for `token` events). */
    text?: string;
    /** Thinking / reasoning content (for `thinking` events). */
    thinking?: string;
    /** Final complete response (for `done` events). */
    response?: LlmResponse;
    /** Error message (for `error` events). */
    error?: string;
}
/**
 * Call LLM with streaming — yields tokens as they arrive.
 * Mirrors Claude Code's streaming UX for progressive output.
 *
 * Usage:
 *   for await (const event of callLLMStream(provider, request)) {
 *     if (event.type === 'token') process.stdout.write(event.text!);
 *     if (event.type === 'done') console.log(event.response);
 *   }
 */
export declare function callLLMStream(provider: RuntimeProviderConfig, request: LlmRequest): AsyncGenerator<StreamEvent>;
//# sourceMappingURL=client.d.ts.map