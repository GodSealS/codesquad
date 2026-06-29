/**
 * LLM call retry helper with rate-limit backoff.
 *
 * S01 — Defensive Execution: adds timeout-aware retry with
 * exponential backoff for 429 rate limits and retryable errors.
 */
export interface RetryOptions {
    /** Maximum retries (default: 2). Not counting the initial attempt. */
    maxRetries?: number;
    /** Abort signal to cancel retries. */
    signal?: AbortSignal;
}
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
export declare function withRetry<T>(fn: () => Promise<T>, opts?: RetryOptions): Promise<T>;
//# sourceMappingURL=retry.d.ts.map