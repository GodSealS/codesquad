/**
 * Workspace files API — manage .codesquad/ directory per workspace.
 *
 * POST /api/workspace/init         → run codesquad init at workspace path
 * GET  /api/workspace/sessions?ws= → load sessions from project .codesquad/sessions-{ws}.json
 * POST /api/workspace/sessions?ws= → save sessions to project .codesquad/sessions-{ws}.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { initProject, installProjectFiles } from '../../core/init-core.js';
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        req.on('error', reject);
    });
}
export async function handleWorkspaceFiles(req, res, services, reqPath, method) {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const wsId = url.searchParams.get('ws') || '';
    // GET /api/workspace/browse-folder — open native folder picker, return absolute path
    if (reqPath === '/api/workspace/browse-folder' && method === 'GET') {
        try {
            const psScript = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Select project directory'; $result = $f.ShowDialog(); if ($result -eq 'OK') { Write-Output $f.SelectedPath } else { Write-Output '' }`;
            const result = execSync(`powershell -NoProfile -NonInteractive -Command "${psScript}"`, { encoding: 'utf-8', timeout: 60000, windowsHide: true }).trim();
            if (result) {
                const folderName = result.split(/[\\/]/).filter(Boolean).pop() || '';
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ path: result, name: folderName }));
            }
            else {
                // User cancelled
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({}));
            }
        }
        catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }
    // POST /api/workspace/init — run codesquad init to create .codesquad/
    if (reqPath === '/api/workspace/init' && method === 'POST') {
        try {
            const body = await readBody(req);
            const { path: wsPath } = JSON.parse(body);
            const target = wsPath || services.projectRoot;
            await initProject({ targetPath: target, tools: 'codebuddy', force: false });
            // Also ensure .codesquad/ directory exists
            const csDir = join(target, '.codesquad');
            if (!existsSync(csDir)) {
                mkdirSync(csDir, { recursive: true });
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, codesquadDir: csDir }));
        }
        catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }
    // POST /api/workspace/reset — force reinstall project files (equivalent to CLI /reset)
    if (reqPath === '/api/workspace/reset' && method === 'POST') {
        try {
            const body = await readBody(req);
            const { path: wsPath } = JSON.parse(body);
            const target = wsPath || services.projectRoot;
            const count = installProjectFiles(target, true);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, count }));
        }
        catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }
    // POST /api/workspace/exec — run a shell command in the project directory
    if (reqPath === '/api/workspace/exec' && method === 'POST') {
        try {
            const body = await readBody(req);
            const { command } = JSON.parse(body);
            if (!command || typeof command !== 'string') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'command is required' }));
                return;
            }
            // Safety: deny obviously dangerous patterns
            const DANGEROUS = [/rm\s+-rf/i, />\s*\/dev\//, /mkfs/i, /dd\s+if=/, /:\(\)/, />\s*\/etc\//i, /format\s+[a-z]:/i];
            for (const p of DANGEROUS) {
                if (p.test(command)) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Command blocked for safety' }));
                    return;
                }
            }
            const { execSync } = await import('child_process');
            const cwd = services.projectRoot;
            // Merge stderr into stdout for unified output
            const stdout = execSync(command, {
                cwd,
                timeout: 30000,
                maxBuffer: 512 * 1024,
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
            });
            const trimmed = stdout.length > 10000 ? stdout.slice(0, 10000) + '\n... (output truncated)' : stdout;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, output: trimmed }));
        }
        catch (err) {
            const output = err.stdout ?? err.stderr ?? err.message ?? 'Command failed';
            const trimmed = output.length > 5000 ? output.slice(0, 5000) + '\n... (truncated)' : output;
            res.writeHead(200, { 'Content-Type': 'application/json' }); // 200 even on error — show output to user
            res.end(JSON.stringify({ ok: false, output: trimmed }));
        }
        return;
    }
    // GET /api/workspace/sessions?ws=...
    if (reqPath === '/api/workspace/sessions' && method === 'GET') {
        if (!wsId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'ws query param required' }));
            return;
        }
        const sessionsFile = join(services.projectRoot, '.codesquad', `sessions-${wsId}.json`);
        try {
            if (existsSync(sessionsFile)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(readFileSync(sessionsFile, 'utf-8'));
            }
            else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end('[]');
            }
        }
        catch {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('[]');
        }
        return;
    }
    // POST /api/workspace/sessions?ws=...
    if (reqPath === '/api/workspace/sessions' && method === 'POST') {
        if (!wsId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'ws query param required' }));
            return;
        }
        try {
            const body = await readBody(req);
            JSON.parse(body); // validate
            const csDir = join(services.projectRoot, '.codesquad');
            if (!existsSync(csDir))
                mkdirSync(csDir, { recursive: true });
            writeFileSync(join(csDir, `sessions-${wsId}.json`), body, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
        }
        catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
}
//# sourceMappingURL=workspace-files.js.map