/**
 * LLM API Rate Limiter — sliding-window QPM enforcement.
 *
 * Prevents exceeding provider rate limits (e.g. 50-60 QPM for DeepSeek V4).
 * Uses a sliding window: tracks recent call timestamps, defers new calls
 * when the window count exceeds the configured QPM threshold.
 */
/** Set rate limits at runtime. */
export declare function setRateLimits(qpm: number, tpm: number): void;
/**
 * Acquire a rate-limit token for an API call with estimated token usage.
 * If the QPM/TPM limit would be exceeded, delays until a slot opens.
 *
 * @param estimatedTokens  Estimated prompt + completion tokens for this call.
 */
export declare function acquireRateLimit(estimatedTokens?: number): Promise<void>;
/**
 * Report a completed API call's actual token usage.
 *
 * NOTE: Only call this if you did NOT pass estimatedTokens to acquireRateLimit().
 * If acquireRateLimit() already accounted for estimated tokens, use adjustTokenUsage()
 * instead to correct the estimate with actual usage.
 */
export declare function reportTokenUsage(promptTokens: number, completionTokens: number): void;
/**
 * Adjust the token estimate from a prior acquireRateLimit() call with
 * actual API response token counts. Prevents double-counting.
 *
 * Usage (in callLLM/callLLMStream):
 *   const estimated = estimateTokens(messages);
 *   await acquireRateLimit(estimated);
 *   const response = await apiCall(...);
 *   adjustTokenUsage(estimated, response.usage.promptTokens + response.usage.completionTokens);
 */
export declare function adjustTokenUsage(estimatedTokens: number, actualTokens: number): void;
/** Get current window statistics for diagnostics. */
export declare function getRateLimitStatus(): {
    qpmUsed: number;
    qpmLimit: number;
    tpmUsed: number;
    tpmLimit: number;
};
//# sourceMappingURL=rate-limiter.d.ts.map