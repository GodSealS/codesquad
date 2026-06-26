/**
 * Chat route — the core chat endpoint for the API.
 *
 * POST /api/chat
 *   Body:  { agentName, message, sessionId?, mode?, model? }
 *   Returns: { content, turns, toolCalls, sessionId, error? }
 *
 * Delegates to src/chat/agent-runner.ts (shared with CLI REPL).
 */
import type { Express } from 'express';
import type { ApiServerConfig } from '../server.js';
export declare function registerChatRoutes(app: Express, config: ApiServerConfig): void;
//# sourceMappingURL=chat.d.ts.map