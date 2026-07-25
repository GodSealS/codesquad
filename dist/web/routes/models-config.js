/**
 * Models Config API — read/write models.config.yaml
 *
 * GET  /api/models-config → return YAML content as text
 * POST /api/models-config → save YAML content, validate syntax
 *
 * Strategy: try embedded data first (Bun-compiled mode),
 *            fall back to filesystem (npm/dev mode).
 *            POST always writes to working directory.
 */
import { readEmbeddedFile } from '../../embedded/runtime.js';
import { ConfigRepository } from '../../config/config-repository.js';
import { invalidateModelsConfigCache } from './chat-v2.js';
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        req.on('error', reject);
    });
}
export async function handleModelsConfig(req, res, services, _path, method) {
    // GET — real filesystem first (user may have edited / POST-saved), embedded fallback
    if (method === 'GET') {
        let yaml = new ConfigRepository(services.projectRoot).readModelsConfig()?.content ?? null;
        if (yaml === null)
            try {
                yaml = readEmbeddedFile('models.config.yaml');
            }
            catch { /* not embedded */ }
        if (yaml === null) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'models.config.yaml not found' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(yaml);
        return;
    }
    // POST — save to working directory (always writable, even in compiled mode)
    if (method === 'POST') {
        try {
            const body = await readBody(req);
            const repository = new ConfigRepository(services.projectRoot);
            repository.writeModelsConfig(body);
            invalidateModelsConfigCache();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, path: repository.modelsConfigPath }));
        }
        catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Invalid YAML: ${err.message}` }));
        }
        return;
    }
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
}
//# sourceMappingURL=models-config.js.map