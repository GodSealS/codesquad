import type { ToolAdapter, SkillDef, ModelsConfig } from '../adapters/types.js';
/** Scan skills/ directory and parse all skill definitions */
export declare function loadSkills(cliSkillsDir: string): Promise<SkillDef[]>;
/**
 * Generate skill files for a single tool adapter.
 *
 * @param adapter       Tool adapter that formats skills and provides output paths
 * @param skills        Parsed SkillDef array from AICore
 * @param outputDir     Target project root (e.g. /path/to/my-project)
 * @param modelsConfig  Optional model resolution config
 * @param sourceSkillsDir  Optional absolute path to AICore/skills/ — when provided,
 *                         companion files (subdirectories, workflow docs, reference
 *                         files) are copied alongside each generated SKILL.md.
 */
export declare function generateSkills(adapter: ToolAdapter, skills: SkillDef[], outputDir: string, modelsConfig?: ModelsConfig, sourceSkillsDir?: string): {
    count: number;
    errors: string[];
};
//# sourceMappingURL=skill-generator.d.ts.map