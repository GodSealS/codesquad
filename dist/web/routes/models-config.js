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
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
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
    // GET — real filesystem first (user may have edited / POST-saved), embedded fallback
    if (method === 'GET') {
        let yaml = null;
        // S05: Read from real filesystem FIRST — bypass virtual-fs which would
        // return stale embedded content. models.config.yaml is user-editable and
        // POST saves to cwd; the embedded copy is a build-time snapshot.
        // 1) Working directory (where POST writes) — highest priority
        const cwdPath = join(process.cwd(), 'models.config.yaml');
        try {
            if (existsSync(cwdPath))
                yaml = readFileSync(cwdPath, 'utf-8');
        }
        catch { /* fall through */ }
        // 1b) Package root (dev mode) — next priority
        if (yaml === null) {
            const configPath = join(PKG_ROOT, 'models.config.yaml');
            try {
                if (existsSync(configPath))
                    yaml = readFileSync(configPath, 'utf-8');
            }
            catch { /* fall through */ }
        }
        // 2) Embedded fallback (Bun-compiled mode where filesystem paths don't exist)
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