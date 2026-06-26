/**
 * Prompt optimization API — simple pass-through to the same LLM endpoint.
 *
 * POST /api/optimize-prompt
 * Accepts: { prompt, agentName?, skillName? }
 * Returns: { optimized }
 */
import type http from 'http';
export declare function handleOptimizePrompt(req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
//# sourceMappingURL=optimize-prompt.d.ts.map