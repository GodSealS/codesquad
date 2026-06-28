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
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { virtualExists, virtualReadFile } from '../../embedded/virtual-fs.js';
import { readEmbeddedFile } from '../../embedded/runtime.js';
// Package root for dev mode — compiled mode bypasses this
let PKG_ROOT;
try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    PKG_ROOT = join(__dirname, '..', '..', '..');
}
catch {
    PKG_ROOT = process.cwd();
}
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        req.on('error', reject);
    });
}
export async function handleModelsConfig(req, res, services, _path, method) {
    // GET — filesystem first (dev mode reflects live edits), embedded fallback (compiled mode)
    if (method === 'GET') {
        let yaml = null;
        // 1) Filesystem first (handles user edits in dev mode)
        const configPath = join(PKG_ROOT, 'models.config.yaml');
        if (virtualExists(configPath)) {
            yaml = virtualReadFile(configPath, 'utf-8');
        }
        // 2) Embedded fallback (Bun-compiled mode where filesystem path doesn't exist)
        if (yaml === null) {
            try {
                yaml = readEmbeddedFile('models.config.yaml');
            }
            catch { /* not embedded */ }
        }
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
        const savePath = join(process.cwd(), 'models.config.yaml');
        try {
            const body = await readBody(req);
            parseYaml(body); // validate YAML syntax
            writeFileSync(savePath, body, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, path: savePath }));
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