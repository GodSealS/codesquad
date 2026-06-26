/**
 * Layered loader — loads agents/skills/rules/hooks from two layers
 * (AICore → Project), with project-level taking highest priority.
 *
 * Layer priority: Project (.codesquad/) > User (AICore/)
 */
import type { RegistryCategory } from './types.js';
/**
 * Collect files from both layers, with project overriding user on name conflicts.
 */
export declare function collectLayeredFiles(category: RegistryCategory, aicoreRoot: string, cwd: string, fileFilter: (filename: string) => boolean, nameMapper: (filename: string) => string): Array<{
    name: string;
    filePath: string;
    layer: 'user' | 'project';
}>;
/**
 * Collect skill directories from both layers.
 */
export declare function collectLayeredSkillDirs(aicoreRoot: string, cwd: string): Array<{
    name: string;
    dirPath: string;
    layer: 'user' | 'project';
}>;
/** Get all source dirs that exist. */
export declare function getAllSourceDirs(category: RegistryCategory, aicoreRoot: string, cwd?: string): Array<{
    dir: string;
    layer: 'user' | 'project';
}>;
//# sourceMappingURL=layered-loader.d.ts.map