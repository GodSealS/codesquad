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
import type { Express } from 'express';
import type { ApiServerConfig } from '../server.js';
export declare function registerSessionRoutes(app: Express, config: ApiServerConfig): void;
//# sourceMappingURL=sessions.d.ts.map