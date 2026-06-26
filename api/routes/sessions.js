/**
 * Session routes — CRUD for chat sessions.
 *
 * Delegates to src/chat/session.ts and src/context/compact.ts.
 *
 * GET    /api/sessions               → listSessions()
 * GET    /api/sessions/:id           → load(id)
 * POST   /api/sessions               → createSession(...)
 * DELETE /api/sessions/:id           → remove(id)
 * POST   /api/sessions/:id/export    → exportSession()
 * POST   /api/sessions/:id/compact   → compactConversation()
 */
import { createSession, save, load, remove, listSessions, findSessionById, } from '../../chat/session.js';
import { exportSession } from '../../chat/import-export.js';
import { compactConversation, applyCompaction } from '../../context/compact.js';
import { callLLM } from '../../llm/client.js';
import { buildRuntimeConfig } from '../../llm/registry.js';
export function registerSessionRoutes(app, config) {
    // List all sessions
    app.get('/api/sessions', async (_req, res) => {
        try {
            const sessions = await listSessions();
            res.json({ sessions, count: sessions.length });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to list sessions', code: 500 });
        }
    });
    // Get single session
    app.get('/api/sessions/:id', async (req, res) => {
        try {
            const sid = String(req.params.id);
            const session = (await load(sid)) ?? (await findSessionById(sid));
            if (!session) {
                res.status(404).json({ error: `Session not found: ${sid}`, code: 404 });
                return;
            }
            res.json(session);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to load session', code: 500 });
        }
    });
    // Create session
    app.post('/api/sessions', async (req, res) => {
        try {
            const { agent, modelConfig, name } = req.body;
            if (!agent) {
                res.status(400).json({ error: 'Missing required field: agent', code: 400 });
                return;
            }
            const session = createSession(agent, modelConfig || { provider: 'anthropic', model: 'claude-sonnet-4-20250514', maxTokens: 4096, temperature: 0.7 }, name);
            await save(session);
            res.status(201).json(session);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to create session', code: 500 });
        }
    });
    // Delete session
    app.delete('/api/sessions/:id', async (req, res) => {
        try {
            await remove(String(req.params.id));
            res.json({ ok: true });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to delete session', code: 500 });
        }
    });
    // Export session
    app.post('/api/sessions/:id/export', async (req, res) => {
        try {
            const sid = String(req.params.id);
            const session = (await load(sid)) ?? (await findSessionById(sid));
            if (!session) {
                res.status(404).json({ error: `Session not found: ${sid}`, code: 404 });
                return;
            }
            const exportPath = await exportSession(session, {
                redactSystem: true,
                redactApiKeys: true,
                redactPaths: false,
            });
            res.json({ path: exportPath });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to export session', code: 500 });
        }
    });
    // Compact session
    app.post('/api/sessions/:id/compact', async (req, res) => {
        try {
            const sid = String(req.params.id);
            const session = (await load(sid)) ?? (await findSessionById(sid));
            if (!session) {
                res.status(404).json({ error: `Session not found: ${sid}`, code: 404 });
                return;
            }
            if (session.messages.length < 10) {
                res.json({ ok: false, message: 'Not enough messages to compact (min 10)' });
                return;
            }
            const model = req.body.model || session.modelConfig.model;
            const result = await compactConversation(session.messages, session, { model }, async (params) => {
                const pid = session.modelConfig.provider;
                const rc = await buildRuntimeConfig(pid);
                if (!rc)
                    throw new Error(`No runtime config for ${pid}`);
                const resp = await callLLM(rc, params);
                return resp.content;
            });
            session.messages = applyCompaction(session.messages, result);
            // Persist compacted session
            if (req.body.save !== false) {
                await save(session);
            }
            res.json({
                ok: true,
                preCompactTokens: result.preCompactTokenCount,
                postCompactTokens: result.postCompactTokenCount,
                savings: Math.round((1 - result.postCompactTokenCount / result.preCompactTokenCount) * 100),
                messageCount: session.messages.length,
            });
        }
        catch (err) {
            res.status(500).json({ error: `Compact failed: ${err.message}`, code: 500 });
        }
    });
}
//# sourceMappingURL=sessions.js.map