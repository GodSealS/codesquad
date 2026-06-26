/**
 * Rule registry — external registration into AICore/rules/ (user-level).
 */
import { existsSync, readdirSync, copyFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getUserCategoryDir } from './paths.js';
import { ensureManifest, addEntriesToManifest, removeEntriesFromManifest } from './manifest.js';
export function scanRuleDir(dir) {
    if (!existsSync(dir))
        return [];
    try {
        return readdirSync(dir)
            .filter(f => f.endsWith('.md') && f !== 'manifest.yaml')
            .map(f => ({ name: f.replace(/\.md$/, ''), filePath: join(dir, f) }));
    }
    catch {
        return [];
    }
}
export function registerRuleFile(aicoreRoot, sourcePath, sourceName) {
    if (!existsSync(sourcePath))
        return `Rule file not found: ${sourcePath}`;
    if (!sourcePath.endsWith('.md'))
        return `Rule file must be .md: ${sourcePath}`;
    const name = sourcePath.replace(/^.*[/\\]/, '').replace(/\.md$/, '');
    const destDir = getUserCategoryDir(aicoreRoot, 'rule');
    mkdirSync(destDir, { recursive: true });
    try {
        copyFileSync(sourcePath, join(destDir, `${name}.md`));
        addEntriesToManifest(aicoreRoot, [{
                name, category: 'rule', source: 'external',
                externalSource: sourceName, registeredAt: new Date().toISOString(),
                sourcePath: join(destDir, `${name}.md`),
            }]);
        return { name };
    }
    catch (err) {
        return `Failed to copy rule: ${err.message}`;
    }
}
export function registerRuleDir(aicoreRoot, sourceDir, sourceName) {
    const result = { count: 0, updated: 0, skipped: 0, errors: [] };
    const destDir = getUserCategoryDir(aicoreRoot, 'rule');
    mkdirSync(destDir, { recursive: true });
    for (const { name, filePath } of scanRuleDir(sourceDir)) {
        try {
            const destPath = join(destDir, `${name}.md`);
            const existed = existsSync(destPath);
            copyFileSync(filePath, destPath);
            result.count++;
            if (existed)
                result.updated++;
            addEntriesToManifest(aicoreRoot, [{
                    name, category: 'rule', source: 'external',
                    externalSource: sourceName, registeredAt: new Date().toISOString(), sourcePath: destPath,
                }]);
        }
        catch (err) {
            result.errors.push(`Rule ${name}: ${err.message}`);
        }
    }
    return result;
}
export function listRegisteredRules(aicoreRoot) {
    return ensureManifest(aicoreRoot).entries.filter(e => e.category === 'rule');
}
export function unregisterRule(aicoreRoot, name) {
    const filePath = join(getUserCategoryDir(aicoreRoot, 'rule'), `${name}.md`);
    if (!existsSync(filePath))
        return false;
    try {
        unlinkSync(filePath);
        removeEntriesFromManifest(aicoreRoot, 'rule', [name]);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=rule-registry.js.map