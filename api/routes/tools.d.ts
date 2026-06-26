/**
 * Tool routes — list and execute CodeSquad tools over HTTP.
 *
 * POST /api/tools/list  → all registered tools (with metadata)
 * POST /api/tools/run   → execute a single tool
 *
 * Delegates to src/tools/registry.ts.
 */
import type { Express } from 'express';
import type { ApiServerConfig } from '../server.js';
export declare function registerToolRoutes(app: Express, config: ApiServerConfig): void;
//# sourceMappingURL=tools.d.ts.map