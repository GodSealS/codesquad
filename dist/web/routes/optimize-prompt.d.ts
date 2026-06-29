/**
 * Prompt optimization API — light-context pass-through to the same LLM endpoint.
 *
 * POST /api/optimize-prompt
 * Accepts: { prompt, agentName?, skillName?, modelName?, sessionId? }
 * Returns: { optimized }
 *
 * If sessionId is provided, injects last 3 conversation turns + agent/skill
 * definition summaries so the optimizer understands the conversation flow.
 */
import type http from 'http';
export declare function handleOptimizePrompt(req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
//# sourceMappingURL=optimize-prompt.d.ts.map