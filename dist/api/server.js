/**
 * CodeSquad API Server — HTTP bridge between UI and CLI core.
 *
 * Provides REST endpoints for chat, agents, skills, sessions, tools, and MCP.
 * Shares the same Node process and core modules as the REPL.
 *
 * Start:  codesquad --serve [port]
 *         or: await startApiServer(config)
 */
import express from 'express';
import cors from 'cors';
import { registerChatRoutes } from './routes/chat.js';
import { registerAgentRoutes } from './routes/agents.js';
import { registerSkillRoutes } from './routes/skills.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { registerToolRoutes } from './routes/tools.js';
import { registerMCPRoutes } from './routes/mcp.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';
let _apiState = null;
export function setApiState(state) {
    _apiState = state;
}
export function getApiState() {
    return _apiState;
}
export async function startApiServer(config) {
    const app = express();
    // CORS — restrict to known origins
    app.use(cors({
        origin: config.corsOrigins.length > 0 ? config.corsOrigins : '*',
        credentials: true,
    }));
    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    // Optional auth (disabled unless CODESQUAD_API_TOKEN is set)
    app.use('/api', authMiddleware);
    // Health check (no auth required)
    app.get('/api/health', (_req, res) => res.json({
        status: 'ok',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    }));
    // Register route groups
    registerAgentRoutes(app, config);
    registerSkillRoutes(app, config);
    registerSessionRoutes(app, config);
    registerToolRoutes(app, config);
    registerMCPRoutes(app, config);
    registerChatRoutes(app, config);
    // Error handler (must be registered last)
    app.use(errorHandler);
    return new Promise((resolve) => {
        app.listen(config.port, config.host, () => {
            const authMsg = process.env.CODESQUAD_API_TOKEN ? ' [auth enabled]' : '';
            console.log(`[API] CodeSquad API server ready → http://${config.host}:${config.port}${authMsg}`);
            console.log(`[API] Endpoints: /api/health /api/agents /api/skills /api/sessions /api/tools /api/mcp /api/chat`);
            resolve();
        });
    });
}
//# sourceMappingURL=server.js.map