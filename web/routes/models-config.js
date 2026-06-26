/**
 * Models Config API — read/write models.config.yaml
 *
 * GET  /api/models-config → return YAML content as text
 * POST /api/models-config → save YAML content, validate syntax
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
// CLI package root — models.config.yaml lives with the CLI, not the project
const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..', '..', '..');
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        req.on('error', reject);
    });
}
export async function handleModelsConfig(req, res, services, _path, method) {
    const configPath = join(PKG_ROOT, 'models.config.yaml');
    // GET — return current config
    if (method === 'GET') {
        if (!existsSync(configPath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'models.config.yaml not found' }));
            return;
        }
        const yaml = readFileSync(configPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(yaml);
        return;
    }
    // POST — save config
    if (method === 'POST') {
        try {
            const body = await readBody(req);
            parseYaml(body);
            writeFileSync(configPath, body, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
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