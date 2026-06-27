/**
 * Registry index — unified facade for two-layer registration.
 *
 * Layers: Project (.codesquad/) > User (AICore/)
 *
 * Usage:
 *   import { registerSource } from '../registry/index.js';
 *   registerSource(aicoreRoot, { name: 'my-plugin', path: '/path/to/plugin', category: 'agent' });
 */
export { CATEGORY_DIRS, CATEGORY_EXT } from './types.js';
export { getUserCategoryDir, getProjectRoot, getProjectCategory, getManifestPath, getLayeredSourceDirs } from './paths.js';
export { readManifest, writeManifest, ensureManifest, addEntriesToManifest, removeEntriesFromManifest, updateAicoreMeta, findOverrides } from './manifest.js';
export { collectLayeredFiles, collectLayeredSkillDirs, getAllSourceDirs } from './layered-loader.js';
export { scanAgentDir, loadAgentFile, registerAgentFile, registerAgentDir, listRegisteredAgents, unregisterAgent } from './agent-registry.js';
export { scanSkillDir, isValidSkill, registerSkillDir, registerSkillsDir, listRegisteredSkills, unregisterSkill } from './skill-registry.js';
export { scanRuleDir, registerRuleFile, registerRuleDir, listRegisteredRules, unregisterRule } from './rule-registry.js';
export { scanHookDir, registerHookFile, registerHookDir, listRegisteredHooks, unregisterHook } from './hook-registry.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { registerAgentDir } from './agent-registry.js';
import { registerSkillsDir } from './skill-registry.js';
import { registerRuleDir } from './rule-registry.js';
import { registerHookDir } from './hook-registry.js';
/**
 * Register an external source into AICore/ (user-level).
 */
export function registerSource(aicoreRoot, options) {
    const { path: sourcePath, name: sourceName, category } = options;
    if (!existsSync(sourcePath)) {
        return { count: 0, updated: 0, skipped: 0, errors: [`Source path not found: ${sourcePath}`] };
    }
    // If sourcePath has a category subdirectory, use it
    const categorySubdir = join(sourcePath, category === 'skill' ? 'skills' : `${category}s`);
    const effectiveDir = existsSync(categorySubdir) ? categorySubdir : sourcePath;
    switch (category) {
        case 'agent': return registerAgentDir(aicoreRoot, effectiveDir, sourceName);
        case 'skill': return registerSkillsDir(aicoreRoot, effectiveDir, sourceName);
        case 'rule': return registerRuleDir(aicoreRoot, effectiveDir, sourceName);
        case 'hook': return registerHookDir(aicoreRoot, effectiveDir, sourceName);
        default: return { count: 0, updated: 0, skipped: 0, errors: [`Unknown category: ${category}`] };
    }
}
//# sourceMappingURL=index.js.map