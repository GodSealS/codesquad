/**
 * Cache Cleanup API — manage DiskCache from Web UI.
 *
 * GET  /api/cache/cleanup → cache stats
 * POST /api/cache/cleanup → clean stale cache entries (>5 days)
 */
import { getDiskCache } from '../../cache/disk-cache.js';
export async function handleCacheCleanup(req, res) {
    const method = req.method?.toUpperCase() ?? 'GET';
    const dc = getDiskCache();
    if (!dc) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, message: 'DiskCache not initialized (no project root set).' }));
        return;
    }
    try {
        if (method === 'POST') {
            // Execute cleanup: delete entries not accessed in 5 days
            const result = await dc.cleanStale(5 * 24 * 60 * 60 * 1000);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                ok: true,
                message: `Cleaned ${result.deleted} stale cache entries (${(result.freedBytes / 1024).toFixed(0)} KB freed).`,
                ...result,
            }));
            return;
        }
        // GET: return stats
        const stats = await dc.stats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            ok: true,
            totalEntries: stats.totalEntries,
            totalSizeKB: Math.round(stats.totalSizeBytes / 1024),
            staleCount: stats.staleCount,
        }));
    }
    catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, message: String(err) }));
    }
}
//# sourceMappingURL=cache-cleanup.js.map