/**
 * Rate Limiter — Sliding Window Algorithm
 *
 * Implements D-10: per-client and global rate limiting for HTTP transport.
 * stdio mode is exempt (single client).
 *
 * Configurable via mcp.config.yaml:
 *   server.rate_limit.per_client_rpm: 60   (default)
 *   server.rate_limit.global_rpm: 600       (default)
 */
interface RateLimitConfig {
    per_client_rpm: number;
    global_rpm: number;
}
/** Simple client ID extraction from HTTP request */
export declare function getClientId(req: {
    headers?: Record<string, string | string[] | undefined>;
    socket?: {
        remoteAddress?: string;
    };
}): string;
export declare class RateLimiter {
    private config;
    private clients;
    private globalTimestamps;
    private windowMs;
    constructor(config?: Partial<RateLimitConfig>);
    /** Check if a request from clientId is allowed. Returns { allowed, retryAfterMs } */
    check(clientId: string): {
        allowed: boolean;
        retryAfterMs?: number;
    };
    /** Get current rate limit status for diagnostics */
    status(clientId?: string): {
        global: {
            count: number;
            limit: number;
        };
        client?: {
            count: number;
            limit: number;
            blockedUntil: number;
        };
    };
    /** Reset all rate limit state */
    reset(): void;
    /** Prune timestamps outside the sliding window */
    private pruneTimestamps;
}
/** Singleton for HTTP transport */
export declare const rateLimiter: RateLimiter;
export {};
//# sourceMappingURL=rate-limiter.d.ts.map