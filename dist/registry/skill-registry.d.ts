/**
 * Skill registry — external registration into .codesquad/skills/ (user-level).
 */
import type { RegistryEntry, RegisterResult } from './types.js';
/** Scan skill subdirectories. */
export declare function scanSkillDir(dir: string): Array<{
    name: string;
    dirPath: string;
}>;
export declare function isValidSkill(skillDirPath: string): boolean;
/** Register a single skill directory to .codesquad/skills/. */
export declare function registerSkillDir(aicoreRoot: string, sourceDir: string, sourceName: string): RegisterResult;
/** Register an entire external skills directory to .codesquad/skills/. */
export declare function registerSkillsDir(aicoreRoot: string, sourceDir: string, sourceName: string): RegisterResult;
export declare function listRegisteredSkills(aicoreRoot: string): RegistryEntry[];
export declare function unregisterSkill(aicoreRoot: string, name: string): boolean;
//# sourceMappingURL=skill-registry.d.ts.map