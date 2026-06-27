/**
 * Cache Cleanup API — manage DiskCache from Web UI.
 *
 * GET  /api/cache/cleanup → cache stats
 * POST /api/cache/cleanup → clean stale cache entries (>5 days)
 */
import type http from 'http';
export declare function handleCacheCleanup(req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
//# sourceMappingURL=cache-cleanup.d.ts.map