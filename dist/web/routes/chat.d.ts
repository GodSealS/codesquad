/**
 * Chat API — SSE streaming agent conversation.
 *
 * POST /api/chat with { sessionId?, agent, message, modelConfig? }
 * Returns SSE stream with events: status, text, tool, tool_result, usage, error, done.
 */
import type http from 'http';
interface WebServices {
    projectRoot: string;
}
export declare function handleChat(req: http.IncomingMessage, res: http.ServerResponse, services: WebServices): Promise<void>;
export {};
//# sourceMappingURL=chat.d.ts.map