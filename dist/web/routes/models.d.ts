/**
 * Models API — returns available models from models.config.yaml api.sources.
 *
 * GET /api/models → list of available model names
 */
import type http from 'http';
export declare function handleModels(_req: http.IncomingMessage, res: http.ServerResponse, services: {
    projectRoot: string;
}): Promise<void>;
/**
 * POST /api/models/verify
 * Tests connectivity for each configured model by calling the API endpoint.
 * Returns { model → { ok, error? } }.
 */
export declare function handleModelsVerify(_req: http.IncomingMessage, res: http.ServerResponse, services: {
    projectRoot: string;
}): Promise<void>;
//# sourceMappingURL=models.d.ts.map