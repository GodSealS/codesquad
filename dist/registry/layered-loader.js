/**
 * Layered loader — loads agents/skills/rules/hooks from two layers
 * (AICore → Project), with project-level taking highest priority.
 *
 * Layer priority: Project (.codesquad/) > User (AICore/)
 */
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { getLayeredSourceDirs } from './paths.js';
/**
 * Collect files from both layers, with project overriding user on name conflicts.
 */
export function collectLayeredFiles(category, aicoreRoot, cwd, fileFilter, nameMapper) {
    const dirs = getLayeredSourceDirs(category, aicoreRoot, cwd);
    const seen = new Map();
    const layers = ['user', 'project'];
    for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i];
        if (!existsSync(dir))
            continue;
        try {
            for (const entry of readdirSync(dir)) {
                if (!fileFilter(entry))
                    continue;
                seen.set(nameMapper(entry), { filePath: join(dir, entry), layer: layers[i] });
            }
        }
        catch { /* skip */ }
    }
    return Array.from(seen.entries()).map(([name, { filePath, layer }]) => ({ name, filePath, layer }));
}
/**
 * Collect skill directories from both layers.
 */
export function collectLayeredSkillDirs(aicoreRoot, cwd) {
    const dirs = getLayeredSourceDirs('skill', aicoreRoot, cwd);
    const seen = new Map();
    const layers = ['user', 'project'];
    for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i];
        if (!existsSync(dir))
            continue;
        try {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
                if (!entry.isDirectory())
                    continue;
                if (!existsSync(join(dir, entry.name, 'SKILL.md')))
                    continue;
                seen.set(entry.name, { dirPath: join(dir, entry.name), layer: layers[i] });
            }
        }
        catch { /* skip */ }
    }
    return Array.from(seen.entries()).map(([name, { dirPath, layer }]) => ({ name, dirPath, layer }));
}
/** Get all source dirs that exist. */
export function getAllSourceDirs(category, aicoreRoot, cwd) {
    const dirs = getLayeredSourceDirs(category, aicoreRoot, cwd);
    const layers = ['user', 'project'];
    const result = [];
    for (let i = 0; i < dirs.length; i++) {
        if (existsSync(dirs[i]))
            result.push({ dir: dirs[i], layer: layers[i] });
    }
    return result;
}
//# sourceMappingURL=layered-loader.js.map