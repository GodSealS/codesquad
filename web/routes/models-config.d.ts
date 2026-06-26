/**
 * Models Config API — read/write models.config.yaml
 *
 * GET  /api/models-config → return YAML content as text
 * POST /api/models-config → save YAML content, validate syntax
 */
import type http from 'http';
export declare function handleModelsConfig(req: http.IncomingMessage, res: http.ServerResponse, services: {
    projectRoot: string;
}, _path: string, method: string): Promise<void>;
//# sourceMappingURL=models-config.d.ts.map