/**
 * LLM API Rate Limiter — sliding-window QPM enforcement.
 *
 * Prevents exceeding provider rate limits (e.g. 50-60 QPM for DeepSeek V4).
 * Uses a sliding window: tracks recent call timestamps, defers new calls
 * when the window count exceeds the configured QPM threshold.
 */
const DEFAULT_QPM = 50;
const DEFAULT_TPM = 100_000;
/** Timestamp queue for sliding-window rate limiting. */
const callTimestamps = [];
const WINDOW_MS = 60_000; // 1 minute sliding window
/** Configured QPM limit (requests per minute). */
let _qpmLimit = DEFAULT_QPM;
/** Configured TPM limit (tokens per minute). */
let _tpmLimit = DEFAULT_TPM;
/** Rolling token usage within the current window. */
let _windowTokenUsage = 0;
const tokenUsageTimestamps = [];
/** Set rate limits at runtime. */
export function setRateLimits(qpm, tpm) {
    _qpmLimit = qpm;
    _tpmLimit = tpm;
}
/** Purge expired entries from both sliding windows. */
function purgeExpired(now) {
    // Purge QPM call timestamps
    const cutoff = now - WINDOW_MS;
    let i = 0;
    while (i < callTimestamps.length && (callTimestamps[i] ?? 0) < cutoff)
        i++;
    if (i > 0)
        callTimestamps.splice(0, i);
    // Purge TPM usage entries
    let j = 0;
    while (j < tokenUsageTimestamps.length && (tokenUsageTimestamps[j]?.ts ?? 0) < cutoff) {
        _windowTokenUsage -= tokenUsageTimestamps[j]?.tokens ?? 0;
        j++;
    }
    if (j > 0)
        tokenUsageTimestamps.splice(0, j);
}
/**
 * Acquire a rate-limit token for an API call with estimated token usage.
 * If the QPM/TPM limit would be exceeded, delays until a slot opens.
 *
 * @param estimatedTokens  Estimated prompt + completion tokens for this call.
 */
export async function acquireRateLimit(estimatedTokens = 0) {
    const now = Date.now();
    purgeExpired(now);
    // ── QPM check ──
    if (callTimestamps.length >= _qpmLimit) {
        const oldest = callTimestamps[0] ?? now;
        const waitMs = oldest + WINDOW_MS - now + 50; // +50ms buffer
        if (waitMs > 0) {
            console.warn(`[RateLimiter] QPM limit (${_qpmLimit}/min) reached, waiting ${Math.ceil(waitMs / 1000)}s`);
            await new Promise(r => setTimeout(r, waitMs));
            return acquireRateLimit(estimatedTokens); // Re-check after wait
        }
    }
    // ── TPM check ──
    if (_tpmLimit > 0 && estimatedTokens > 0) {
        while (_windowTokenUsage + estimatedTokens > _tpmLimit) {
            const oldest = tokenUsageTimestamps[0]?.ts ?? now;
            const waitMs = oldest + WINDOW_MS - now + 50;
            if (waitMs > 0) {
                console.warn(`[RateLimiter] TPM limit (${_tpmLimit}/min) approaching, waiting ${Math.ceil(waitMs / 1000)}s`);
                await new Promise(r => setTimeout(r, waitMs));
            }
            purgeExpired(Date.now());
        }
        _windowTokenUsage += estimatedTokens;
        tokenUsageTimestamps.push({ ts: now, tokens: estimatedTokens });
    }
    callTimestamps.push(now);
}
/**
 * Report a completed API call's actual token usage.
 *
 * NOTE: Only call this if you did NOT pass estimatedTokens to acquireRateLimit().
 * If acquireRateLimit() already accounted for estimated tokens, use adjustTokenUsage()
 * instead to correct the estimate with actual usage.
 */
export function reportTokenUsage(promptTokens, completionTokens) {
    const total = promptTokens + completionTokens;
    purgeExpired(Date.now());
    _windowTokenUsage += total;
    tokenUsageTimestamps.push({ ts: Date.now(), tokens: total });
}
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
export function adjustTokenUsage(estimatedTokens, actualTokens) {
    const delta = actualTokens - estimatedTokens;
    if (delta === 0)
        return;
    purgeExpired(Date.now());
    _windowTokenUsage += delta;
    tokenUsageTimestamps.push({ ts: Date.now(), tokens: delta });
}
/** Get current window statistics for diagnostics. */
export function getRateLimitStatus() {
    purgeExpired(Date.now());
    return {
        qpmUsed: callTimestamps.length,
        qpmLimit: _qpmLimit,
        tpmUsed: _windowTokenUsage,
        tpmLimit: _tpmLimit,
    };
}
//# sourceMappingURL=rate-limiter.js.map