/**
 * Workspace files API — manage .codesquad/ directory per workspace.
 *
 * POST /api/workspace/init         → run codesquad init at workspace path
 * GET  /api/workspace/sessions?ws= → load sessions from project .codesquad/sessions-{ws}.json
 * POST /api/workspace/sessions?ws= → save sessions to project .codesquad/sessions-{ws}.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { initProject, installProjectFiles } from '../../core/init-core.js';
import { runToolUse } from '../../tools/registry.js';
import { getSessionCache } from '../../tools/file-state.js';
import { resolveWorkspacePath } from '../../security/path-policy.js';
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        req.on('error', reject);
    });
}
/** Init/reset are project administration operations, never arbitrary-path writes. */
function resolveRegisteredWorkspace(projectRoot, requestedPath) {
    const root = resolveWorkspacePath(projectRoot, '.');
    const target = resolveWorkspacePath(projectRoot, typeof requestedPath === 'string' && requestedPath.trim()
        ? requestedPath
        : '.');
    if (target !== root) {
        throw new Error('Only the active project workspace may be initialized or reset');
    }
    return target;
}
export async function handleWorkspaceFiles(req, res, services, reqPath, method) {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const rawWsId = url.searchParams.get('ws') || '';
    // Path traversal guard: reject wsId containing .., /, \, or null bytes
    if (rawWsId.includes('..') || rawWsId.includes('/') || rawWsId.includes('\\') || rawWsId.includes('\0')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid ws parameter' }));
        return;
    }
    const wsId = rawWsId;
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
            const target = resolveRegisteredWorkspace(services.projectRoot, wsPath);
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
            const target = resolveRegisteredWorkspace(services.projectRoot, wsPath);
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
            const context = {
                session: undefined,
                cwd: services.projectRoot,
                projectRoot: services.projectRoot,
                abortSignal: new AbortController().signal,
                permissionMode: 'default',
                readFileState: getSessionCache(),
                headless: true,
            };
            const result = await runToolUse({
                toolName: 'Bash',
                rawInput: { command, timeout: 30 },
                context,
            });
            if (result.needsApproval) {
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, needsApproval: true, output: result.content }));
                return;
            }
            res.writeHead(result.isError ? 400 : 200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: !result.isError, output: result.content }));
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
        const lastActiveFile = join(services.projectRoot, '.codesquad', `last-session-${wsId}.txt`);
        let lastActiveId = null;
        try {
            if (existsSync(lastActiveFile))
                lastActiveId = readFileSync(lastActiveFile, 'utf-8').trim();
        }
        catch { }
        try {
            // ── Load web sessions from aggregated file ──
            let webSessions = [];
            if (existsSync(sessionsFile)) {
                const raw = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
                webSessions = Array.isArray(raw) ? raw : (raw.sessions ?? []);
            }
            // ── Scan backend REPL sessions (.codesquad/sessions/*.json) ──
            const backendSessions = scanBackendSessions(services.projectRoot);
            // ── Merge: web sessions take priority, backend sessions fill gaps ──
            const webIds = new Set(webSessions.map((s) => s.id));
            for (const bs of backendSessions) {
                if (!webIds.has(bs.id)) {
                    webSessions.push(bs);
                }
            }
            // Sort by createdTime descending (newest first)
            webSessions.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ sessions: webSessions, lastActiveId }));
        }
        catch {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ sessions: [], lastActiveId }));
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
            const parsed = JSON.parse(body);
            const csDir = join(services.projectRoot, '.codesquad');
            if (!existsSync(csDir))
                mkdirSync(csDir, { recursive: true });
            // Extract sessions array (frontend sends { sessions: [...], lastActiveId } or bare array)
            const sessionsArray = Array.isArray(parsed.sessions) ? parsed.sessions : (Array.isArray(parsed) ? parsed : []);
            // ── Detect deleted sessions and remove their backend files ──
            const sessionsFilePath = join(csDir, `sessions-${wsId}.json`);
            const oldIds = new Set();
            if (existsSync(sessionsFilePath)) {
                try {
                    const oldRaw = JSON.parse(readFileSync(sessionsFilePath, 'utf-8'));
                    const oldSessions = Array.isArray(oldRaw) ? oldRaw : (oldRaw.sessions ?? []);
                    for (const s of oldSessions) {
                        if (s.id)
                            oldIds.add(s.id);
                    }
                }
                catch { /* best effort */ }
            }
            const newIds = new Set(sessionsArray.map((s) => s.id).filter(Boolean));
            const sessionsBackendDir = join(csDir, 'sessions');
            for (const oldId of oldIds) {
                if (!newIds.has(oldId)) {
                    // Session removed from UI → delete backend file
                    const backendFile = join(sessionsBackendDir, `${oldId}.json`);
                    try {
                        if (existsSync(backendFile)) {
                            unlinkSync(backendFile);
                            console.log(`[workspace] Deleted backend session: ${oldId}`);
                        }
                    }
                    catch { /* best effort */ }
                }
            }
            writeFileSync(sessionsFilePath, JSON.stringify(sessionsArray), 'utf-8');
            // Persist last active session ID
            const lastActiveId = parsed.lastActiveId ?? null;
            if (lastActiveId) {
                writeFileSync(join(csDir, `last-session-${wsId}.txt`), String(lastActiveId), 'utf-8');
            }
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
/** Scan .codesquad/sessions/ for backend REPL sessions and convert to ChatSession format. */
function scanBackendSessions(projectRoot) {
    const sessionsDir = join(projectRoot, '.codesquad', 'sessions');
    if (!existsSync(sessionsDir))
        return [];
    const result = [];
    try {
        const files = readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            try {
                const raw = readFileSync(join(sessionsDir, file), 'utf-8');
                const sess = JSON.parse(raw);
                if (!sess.id || !sess.messages)
                    continue;
                // Convert backend messages to frontend format
                const messages = sess.messages.map((m, i) => ({
                    id: `msg-${sess.id}-${i}`,
                    sender: m.role === 'assistant' ? 'assistant'
                        : m.role === 'user' ? 'user'
                            : m.role === 'system' ? 'system'
                                : 'info',
                    content: m.content || '',
                    timestamp: m.timestamp || sess.createdAt,
                }));
                result.push({
                    id: sess.id,
                    title: sess.name || `${sess.agent}: 会话`,
                    agentId: sess.agent,
                    workspaceDir: 'root',
                    messages,
                    createdTime: sess.createdAt,
                    mode: (sess.mode === 'Craft' || sess.mode === 'Ask' || sess.mode === 'Plan')
                        ? sess.mode : 'Ask',
                });
            }
            catch { /* skip unreadable */ }
        }
    }
    catch { /* dir read failed */ }
    return result;
}
//# sourceMappingURL=workspace-files.js.map