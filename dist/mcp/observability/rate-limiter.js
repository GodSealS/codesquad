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
const DEFAULT_CONFIG = {
    per_client_rpm: 60,
    global_rpm: 600,
};
/** Simple client ID extraction from HTTP request */
export function getClientId(req) {
    // Try X-Forwarded-For (proxy)
    const xff = req.headers?.['x-forwarded-for'];
    if (typeof xff === 'string')
        return xff.split(',')[0]?.trim() ?? 'unknown';
    // Fallback to remote address
    return req.socket?.remoteAddress ?? 'unknown';
}
export class RateLimiter {
    config;
    clients = new Map();
    globalTimestamps = [];
    windowMs = 60_000; // 1 minute
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /** Check if a request from clientId is allowed. Returns { allowed, retryAfterMs } */
    check(clientId) {
        const now = Date.now();
        // 1. Global rate limit
        this.pruneTimestamps(this.globalTimestamps, now);
        if (this.globalTimestamps.length >= this.config.global_rpm) {
            const oldest = this.globalTimestamps[0] ?? now;
            return { allowed: false, retryAfterMs: this.windowMs - (now - oldest) };
        }
        // 2. Per-client rate limit
        let bucket = this.clients.get(clientId);
        if (!bucket) {
            bucket = { timestamps: [], blockedUntil: 0 };
            this.clients.set(clientId, bucket);
        }
        // Check if client is blocked
        if (bucket.blockedUntil > now) {
            return { allowed: false, retryAfterMs: bucket.blockedUntil - now };
        }
        this.pruneTimestamps(bucket.timestamps, now);
        if (bucket.timestamps.length >= this.config.per_client_rpm) {
            bucket.blockedUntil = now + 60_000; // Block for 1 minute
            return { allowed: false, retryAfterMs: 60_000 };
        }
        // Allow — record
        bucket.timestamps.push(now);
        this.globalTimestamps.push(now);
        return { allowed: true };
    }
    /** Get current rate limit status for diagnostics */
    status(clientId) {
        const now = Date.now();
        this.pruneTimestamps(this.globalTimestamps, now);
        const result = {
            global: { count: this.globalTimestamps.length, limit: this.config.global_rpm },
        };
        if (clientId) {
            const bucket = this.clients.get(clientId);
            if (bucket) {
                this.pruneTimestamps(bucket.timestamps, now);
                result.client = {
                    count: bucket.timestamps.length,
                    limit: this.config.per_client_rpm,
                    blockedUntil: bucket.blockedUntil,
                };
            }
        }
        return result;
    }
    /** Reset all rate limit state */
    reset() {
        this.clients.clear();
        this.globalTimestamps = [];
    }
    /** Prune timestamps outside the sliding window */
    pruneTimestamps(timestamps, now) {
        const cutoff = now - this.windowMs;
        while (timestamps.length > 0 && (timestamps[0] ?? 0) < cutoff) {
            timestamps.shift();
        }
    }
}
/** Singleton for HTTP transport */
export const rateLimiter = new RateLimiter();
//# sourceMappingURL=rate-limiter.js.map