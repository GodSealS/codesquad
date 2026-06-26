/**
 * Sessions API — list, detail, delete.
 * Shares session store with REPL via ~/.codesquad/sessions/.
 */
import { listSessions, load, remove } from '../../chat/session.js';
export async function handleSessions(req, res, services, path, method) {
    const id = path.slice('/api/sessions'.length).replace(/^\/+/, '');
    // GET /api/sessions/:id
    if (id && method === 'GET') {
        const session = await load(id);
        if (!session) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Session not found' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(session));
        return;
    }
    // DELETE /api/sessions/:id
    if (id && method === 'DELETE') {
        await remove(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
    }
    // GET /api/sessions?status=active&agent=game-designer&q=search&limit=20&offset=0
    if (method === 'GET') {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const status = url.searchParams.get('status');
        const agent = url.searchParams.get('agent');
        const query = url.searchParams.get('q')?.toLowerCase();
        const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
        const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
        let sessions = await listSessions();
        if (status)
            sessions = sessions.filter((s) => s.status === status);
        if (agent)
            sessions = sessions.filter((s) => s.agent === agent);
        if (query) {
            sessions = sessions.filter((s) => s.name.toLowerCase().includes(query) || s.agent.toLowerCase().includes(query));
        }
        const total = sessions.length;
        const paged = sessions.slice(offset, offset + limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sessions: paged, total }));
        return;
    }
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
}
//# sourceMappingURL=sessions.js.map