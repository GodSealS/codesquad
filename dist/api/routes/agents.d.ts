/**
 * Agent routes — serves agent list/detail from .codesquad/agents/*.md.
 *
 * Replaces UI's static /docs/agents.json with live .codesquad data.
 *
 * GET /api/agents        → list all agents
 * GET /api/agents/:name  → single agent prompt + frontmatter
 */
import type { Express } from 'express';
import type { ApiServerConfig } from '../server.js';
export declare function registerAgentRoutes(app: Express, config: ApiServerConfig): void;
//# sourceMappingURL=agents.d.ts.map