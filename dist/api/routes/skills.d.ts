/**
 * Skill routes — serves skill list/detail from SkillRegistry.
 *
 * Replaces UI's static /docs/skills.json with live registry data.
 *
 * GET /api/skills        → list all user-invocable skills
 * GET /api/skills/:name  → single skill detail
 */
import type { Express } from 'express';
import type { ApiServerConfig } from '../server.js';
export declare function registerSkillRoutes(app: Express, config: ApiServerConfig): void;
//# sourceMappingURL=skills.d.ts.map