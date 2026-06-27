/**
 * Multi-provider router with automatic fallback chain.
 *
 * Order: primary → fallback_chain (from Config/mcp.config.yaml) → Ollama (last resort)
 *
 * Phase P3.6
 */
import { type LlmRequest, type LlmResponse } from './client.js';
/**
 * Call LLM with automatic fallback across configured providers.
 *
 * Chain: primary → fallback providers (from Config/mcp.config.yaml) → Ollama
 * Skips providers with open circuit breakers or missing API keys.
 */
export declare function callWithFallback(request: LlmRequest, primaryProvider: string, primaryModel: string, projectRoot?: string): Promise<LlmResponse & {
    routedVia: string;
}>;
/**
 * Format a human-readable fallback chain description.
 */
export declare function getFallbackChainDescription(primaryProvider: string, projectRoot?: string): string;
//# sourceMappingURL=router.d.ts.map