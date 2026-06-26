/**
 * Offline fallback — detects local Ollama and auto-switches when network is down.
 * Phase 1.6 — Step 1.6.4.
 */
import type { RuntimeProviderConfig } from './provider.js';
import type { LlmRequest, LlmResponse } from './client.js';
export declare function detectOllama(): Promise<boolean>;
export declare function listOllamaModels(): Promise<string[]>;
export declare function callOllama(model: string, request: LlmRequest): Promise<LlmResponse>;
export declare function registerOllamaProvider(): Promise<void>;
/**
 * Get a fallback runtime config for Ollama (no API key needed).
 */
export declare function getOllamaRuntimeConfig(): Partial<RuntimeProviderConfig>;
//# sourceMappingURL=fallback.d.ts.map