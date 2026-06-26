/**
 * MCP Server — Skill Tools
 *
 * Implements:
 *   - skill.list    — list all skills with metadata
 *   - skill.schema  — get full interface contract for a specific skill
 *   - skill.invoke  — execute a skill (Phase 5, stub for now)
 */
import type { MCPCallToolResult } from '../transport/types.js';
/** Route a skill tool call */
export declare function handleSkillTool(toolName: string, params?: Record<string, unknown>): Promise<MCPCallToolResult | null>;
/** Skill invoke arguments type */
import type { SkillInvokeArgs } from '../executor/skill-runner.js';
export type { SkillInvokeArgs };
//# sourceMappingURL=skill-tools.d.ts.map