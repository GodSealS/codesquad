/**
 * Files API — project file tree and content reading.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, resolve, normalize } from 'path';
import { countTokens } from '../../chat/tokenizer.js';
function isSafePath(root, target) {
    const resolved = resolve(root, target);
    const normalizedRoot = normalize(root);
    return resolved.startsWith(normalizedRoot);
}
function listDir(dir, depth, maxDepth) {
    if (depth > maxDepth)
        return [];
    const ignore = new Set(['node_modules', '.git', '.codebuddy', 'dist', 'coverage', '__pycache__']);
    try {
        const entries = readdirSync(dir, { withFileTypes: true });
        return entries
            .filter((e) => !ignore.has(e.name) && !e.name.startsWith('.'))
            .map((e) => {
            if (e.isDirectory()) {
                const children = listDir(join(dir, e.name), depth + 1, maxDepth);
                return { name: e.name + '/', type: 'directory', children: children.length };
            }
            const fullPath = join(dir, e.name);
            let size = 0;
            let tokens;
            try {
                const stat = statSync(fullPath);
                size = stat.size;
                if (size < 50000 && /\.(md|ts|js|yaml|yml|json|txt|html|css)$/i.test(e.name)) {
                    const content = readFileSync(fullPath, 'utf-8');
                    tokens = countTokens('gpt-4o', content);
                }
            }
            catch { /* skip */ }
            return { name: e.name, type: 'file', size, tokens };
        });
    }
    catch {
        return [];
    }
}
export async function handleFiles(req, res, services, path, method) {
    const root = services.projectRoot;
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    // GET /api/files/read?path=...
    if (path === '/api/files/read' && method === 'GET') {
        const filePath = url.searchParams.get('path');
        if (!filePath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '?path is required' }));
            return;
        }
        if (!isSafePath(root, filePath)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Path traversal denied' }));
            return;
        }
        const fullPath = join(root, filePath);
        if (!existsSync(fullPath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'File not found' }));
            return;
        }
        try {
            const content = readFileSync(fullPath, 'utf-8');
            const stat = statSync(fullPath);
            const tokens = countTokens('gpt-4o', content);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ path: filePath, content, tokens, size: stat.size }));
        }
        catch {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to read file' }));
        }
        return;
    }
    // GET /api/files?path=...
    const subPath = url.searchParams.get('path') ?? '';
    const target = subPath ? join(root, subPath) : root;
    if (!isSafePath(root, subPath)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Path traversal denied' }));
        return;
    }
    const entries = listDir(target, 0, 3);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ path: subPath || '/', entries }));
}
//# sourceMappingURL=files.js.map