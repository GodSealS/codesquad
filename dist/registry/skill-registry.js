/**
 * Skill registry — external registration into .codesquad/skills/ (user-level).
 */
import { existsSync, readdirSync, mkdirSync, rmdirSync } from 'fs';
import { join, basename } from 'path';
import { getUserCategoryDir } from './paths.js';
import { ensureManifest, addEntriesToManifest, removeEntriesFromManifest } from './manifest.js';
import { walkCopyDir } from './fs-utils.js';
/** Scan skill subdirectories. */
export function scanSkillDir(dir) {
    if (!existsSync(dir))
        return [];
    try {
        return readdirSync(dir, { withFileTypes: true })
            .filter(d => d.isDirectory() && d.name !== 'manifest.yaml')
            .map(d => ({ name: d.name, dirPath: join(dir, d.name) }));
    }
    catch {
        return [];
    }
}
export function isValidSkill(skillDirPath) {
    return existsSync(join(skillDirPath, 'SKILL.md'));
}
/** Register a single skill directory to .codesquad/skills/. */
export function registerSkillDir(aicoreRoot, sourceDir, sourceName) {
    const result = { count: 0, updated: 0, skipped: 0, errors: [] };
    const skillName = basename(sourceDir);
    if (!isValidSkill(sourceDir)) {
        result.errors.push(`Skill ${skillName}: missing SKILL.md`);
        return result;
    }
    const destDir = getUserCategoryDir(aicoreRoot, 'skill');
    mkdirSync(destDir, { recursive: true });
    const destPath = join(destDir, skillName);
    try {
        const existed = existsSync(destPath);
        const count = walkCopyDir(sourceDir, destPath, true);
        result.count = count;
        if (existed)
            result.updated++;
        addEntriesToManifest(aicoreRoot, [{
                name: skillName, category: 'skill', source: 'external',
                externalSource: sourceName, registeredAt: new Date().toISOString(), sourcePath: destPath,
            }]);
    }
    catch (err) {
        result.errors.push(`Skill ${skillName}: ${err.message}`);
    }
    return result;
}
/** Register an entire external skills directory to .codesquad/skills/. */
export function registerSkillsDir(aicoreRoot, sourceDir, sourceName) {
    const result = { count: 0, updated: 0, skipped: 0, errors: [] };
    const destDir = getUserCategoryDir(aicoreRoot, 'skill');
    mkdirSync(destDir, { recursive: true });
    for (const { name, dirPath } of scanSkillDir(sourceDir)) {
        if (!isValidSkill(dirPath)) {
            result.errors.push(`Skill ${name}: missing SKILL.md`);
            continue;
        }
        try {
            const destPath = join(destDir, name);
            const existed = existsSync(destPath);
            const count = walkCopyDir(dirPath, destPath, true);
            result.count += count;
            if (existed)
                result.updated++;
            addEntriesToManifest(aicoreRoot, [{
                    name, category: 'skill', source: 'external',
                    externalSource: sourceName, registeredAt: new Date().toISOString(), sourcePath: destPath,
                }]);
        }
        catch (err) {
            result.errors.push(`Skill ${name}: ${err.message}`);
        }
    }
    return result;
}
export function listRegisteredSkills(aicoreRoot) {
    return ensureManifest(aicoreRoot).entries.filter(e => e.category === 'skill');
}
export function unregisterSkill(aicoreRoot, name) {
    const dir = getUserCategoryDir(aicoreRoot, 'skill');
    const dirPath = join(dir, name);
    if (!existsSync(dirPath))
        return false;
    try {
        rmdirSync(dirPath, { recursive: true });
        removeEntriesFromManifest(aicoreRoot, 'skill', [name]);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=skill-registry.js.map