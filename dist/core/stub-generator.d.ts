/**
 * Stub Generator
 *
 * Converts full .codesquad agent/skill definitions to MCP stub format (v2).
 * Reads from .codesquad/ and writes .aicore-mcp-stubs/ (or in-place).
 */
/** Generate MCP stub for an agent */
export declare function generateAgentStub(filePath: string, outputDir?: string): string | null;
/** Generate MCP stub for a skill */
export declare function generateSkillStub(skillDirPath: string, outputDir?: string): string | null;
/** Batch convert all agents */
export declare function convertAllAgents(outputDir: string): {
    total: number;
    converted: number;
    errors: string[];
};
/** Back up .codesquad/agents/ and .codesquad/skills/ to a timestamped directory */
export declare function backupAicore(backupDir?: string): {
    path: string;
    agents: number;
    skills: number;
};
/**
 * Convert .codesquad files in-place (DANGEROUS - use backupAicore() first).
 * Replaces .md files in agents/ dir and SKILL.md files in skills/ dir with MCP stubs.
 *
 * WARNING: Per D-02 decision (2026-06-14): only use after @codesquad/aicore-content is ready.
 */
export declare function convertAicoreInPlace(): {
    agents: number;
    skills: number;
    errors: string[];
};
/** Batch convert all skills */
export declare function convertAllSkills(outputDir: string): {
    total: number;
    converted: number;
    errors: string[];
};
//# sourceMappingURL=stub-generator.d.ts.map