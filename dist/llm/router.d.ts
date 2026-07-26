/**
 * Multi-provider router with automatic fallback chain.
 *
 * Order: primary → fallback_chain (from Config/mcp.config.yaml)
 *
 * Phase P3.6
 */
import { type LlmRequest, type LlmResponse } from './client.js';
/**
 * Call LLM with automatic fallback across configured providers.
 *
 * Chain: primary → fallback providers (from Config/mcp.config.yaml)
 * Skips providers with open circuit breakers or missing API keys.
 *
 * NOTE: No automatic local-model fallback. If all providers fail,
 * the caller receives an error and should prompt the user to configure
 * a local model via the settings panel.
 */
export declare function callWithFallback(request: LlmRequest, primaryProvider: string, primaryModel: string, projectRoot?: string): Promise<LlmResponse & {
    routedVia: string;
}>;
/**
 * Format a human-readable fallback chain description.
 */
export declare function getFallbackChainDescription(primaryProvider: string, projectRoot?: string): string;
//# sourceMappingURL=router.d.ts.map