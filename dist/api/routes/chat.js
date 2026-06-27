/**
 * Chat route — the core chat endpoint for the API.
 *
 * POST /api/chat
 *   Body:  { agentName, message, sessionId?, mode?, model? }
 *   Returns: { content, turns, toolCalls, sessionId, error? }
 *
 * Delegates to src/chat/agent-runner.ts (shared with CLI REPL).
 */
import { runAgent } from '../../chat/agent-runner.js';
import { createSession, save, load, findSessionById } from '../../chat/session.js';
import { getApiState } from '../server.js';
const DEFAULT_MODEL_CONFIG = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    temperature: 0.7,
};
export function registerChatRoutes(app, config) {
    app.post('/api/chat', async (req, res) => {
        try {
            const { agentName, message, sessionId, mode = 'ask', model = DEFAULT_MODEL_CONFIG.model, } = req.body;
            if (!agentName || !message) {
                res.status(400).json({
                    error: 'Missing required fields: agentName, message',
                    code: 400,
                });
                return;
            }
            // Resolve or create session
            let session = sessionId
                ? ((await load(sessionId)) ?? (await findSessionById(sessionId)))
                : null;
            if (!session) {
                const apiState = getApiState();
                session = createSession(agentName, {
                    provider: apiState?.providerId || DEFAULT_MODEL_CONFIG.provider,
                    model: model || DEFAULT_MODEL_CONFIG.model,
                    maxTokens: DEFAULT_MODEL_CONFIG.maxTokens,
                    temperature: DEFAULT_MODEL_CONFIG.temperature,
                });
            }
            // Run agent
            const toolCallsLog = [];
            const result = await runAgent({
                agentName,
                userInput: message,
                session,
                providerId: getApiState()?.providerId || session.modelConfig.provider,
                modelId: model || session.modelConfig.model,
                projectRoot: config.projectRoot,
                aicoreDir: config.aicoreDir,
                mode: mode,
                onToolUse: (toolName, input, toolResult) => {
                    toolCallsLog.push({ name: toolName, input, isError: toolResult.isError });
                },
            });
            // Persist session
            await save(session);
            res.json({
                content: result.finalResponse,
                turns: result.turnsUsed,
                toolCalls: toolCallsLog,
                sessionId: session.id,
                error: result.error,
            });
        }
        catch (err) {
            res.status(500).json({
                error: `Chat request failed: ${err.message}`,
                code: 500,
            });
        }
    });
}
//# sourceMappingURL=chat.js.map