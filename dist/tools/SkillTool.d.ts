/**
 * SkillTool — Allow agents to dynamically invoke skills during execution.
 *
 * Enabled for all agents. The tool loads a skill's SKILL.md from .codesquad/skills/
 * and injects its body (instructions) into the session context for subsequent turns.
 *
 * Phase 4 — Chat Feature Gap Fill
 */
export declare const SkillTool: import("./types.js").Tool<{
    skill: string;
    args?: string | undefined;
}, unknown>;
//# sourceMappingURL=SkillTool.d.ts.map