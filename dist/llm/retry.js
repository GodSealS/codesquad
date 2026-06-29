/**
 * LLM call retry helper with rate-limit backoff.
 *
 * S01 — Defensive Execution: adds timeout-aware retry with
 * exponential backoff for 429 rate limits and retryable errors.
 */
import { LlmError } from './client.js';
// ── Constants ──
/** Maximum number of 429 retries before giving up. */
const MAX_429_RETRIES = 3;
/** Base delay in milliseconds for exponential backoff. */
const BASE_DELAY_MS = 1000;
/** Maximum backoff delay cap. */
const MAX_BACKOFF_MS = 30_000;
/** Delay for generic retryable errors (non-429). */
const GENERIC_RETRY_DELAY_MS = 500;
// ── Main ──
/**
 * Call `fn` with automatic retry on retryable errors.
 *
 * Retryable errors:
 * - 429 rate limit → exponential backoff (1s, 2s, 4s), max 3 attempts
 * - Network errors (ECONNREFUSED, ETIMEDOUT, etc.) → 500ms delay
 *
 * Non-retryable errors (thrown immediately):
 * - 400 Bad Request
 * - 401 Unauthorized
 * - 402 Payment Required
 * - 403 Forbidden
 * - 404 Not Found
 */
export async function withRetry(fn, opts = {}) {
    const maxRetries = opts.maxRetries ?? 2;
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
        // Check abort signal before each attempt
        if (opts.signal?.aborted) {
            throw new LlmError('Request aborted', 0, 'retry');
        }
        try {
            return await fn();
        }
        catch (err) {
            lastError = err;
            // ── 429 Rate Limit → exponential backoff ──
            if (isRateLimitError(err) && i < MAX_429_RETRIES) {
                const delay = Math.min(BASE_DELAY_MS * Math.pow(2, i), MAX_BACKOFF_MS);
                await sleep(delay);
                continue;
            }
            // ── Network errors → generic retry ──
            if (isNetworkError(err) && i < maxRetries) {
                await sleep(GENERIC_RETRY_DELAY_MS);
                continue;
            }
            // ── Non-retryable or retries exhausted ──
            throw err;
        }
    }
    throw lastError ?? new Error('Retry exhausted with no error captured');
}
// ── Error classification ──
function isRateLimitError(err) {
    if (err instanceof LlmError) {
        return err.status === 429 || (err.message?.includes('rate') ?? false);
    }
    const msg = err.message?.toLowerCase() ?? '';
    return msg.includes('429') || msg.includes('rate limit');
}
function isNetworkError(err) {
    if (err instanceof LlmError) {
        // Status 0 = network-level error (not an HTTP response)
        return err.status === 0;
    }
    const code = err.code;
    if (code) {
        return ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'EPIPE'].includes(code);
    }
    const msg = err.message?.toLowerCase() ?? '';
    return msg.includes('fetch failed') || msg.includes('network') || msg.includes('timeout');
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=retry.js.map