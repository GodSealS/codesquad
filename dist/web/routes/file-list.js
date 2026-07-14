/**
 * File list API — serve directory tree for FileExplorer
 *
 * GET /api/files/list?dir=/absolute/path → JSON tree
 */
import { readdirSync, existsSync } from 'fs';
import { join, resolve, normalize, sep } from 'path';
const MAX_DEPTH = 3;
const IGNORE_DIRS = new Set(['node_modules', '.git', '.codebuddy', 'dist', 'coverage', 'Intermediate', 'Saved', 'Binaries', 'DerivedDataCache', '.vs', '__pycache__', '.idea']);
function buildTree(dirPath, depth = 0) {
    if (depth > MAX_DEPTH)
        return [];
    if (!existsSync(dirPath))
        return [];
    try {
        const entries = readdirSync(dirPath, { withFileTypes: true });
        const nodes = [];
        for (const entry of entries) {
            if (entry.name.startsWith('.'))
                continue;
            if (entry.isDirectory() && IGNORE_DIRS.has(entry.name))
                continue;
            const fullPath = join(dirPath, entry.name);
            const node = {
                name: entry.name,
                path: fullPath.replace(/\\/g, '/'),
                type: entry.isDirectory() ? 'directory' : 'file',
            };
            if (entry.isDirectory() && depth < MAX_DEPTH) {
                node.children = buildTree(fullPath, depth + 1);
            }
            nodes.push(node);
        }
        nodes.sort((a, b) => {
            if (a.type !== b.type)
                return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
        return nodes;
    }
    catch {
        return [];
    }
}
/**
 * Validate that a directory path is within the project root.
 * Uses trailing separator to prevent prefix-bypass on Windows.
 */
function isSafeDir(root, target) {
    const resolved = resolve(target);
    const normalizedRoot = normalize(root) + sep;
    return resolved.startsWith(normalizedRoot);
}
export async function handleFileList(req, res, services) {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const dirParam = url.searchParams.get('dir') || services.projectRoot;
    // Path traversal guard — refuse to list directories outside project root
    if (!isSafeDir(services.projectRoot, dirParam)) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Access denied: directory outside project root' }));
        return;
    }
    const tree = buildTree(dirParam);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ root: dirParam, tree }));
}
//# sourceMappingURL=file-list.js.map