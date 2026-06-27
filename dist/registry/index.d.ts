/**
 * Registry index — unified facade for two-layer registration.
 *
 * Layers: Project (.codesquad/) > User (AICore/)
 *
 * Usage:
 *   import { registerSource } from '../registry/index.js';
 *   registerSource(aicoreRoot, { name: 'my-plugin', path: '/path/to/plugin', category: 'agent' });
 */
export type { RegistryManifest, RegistryEntry, RegistryCategory, SourceType, RegisterResult, RegisterSourceOptions, RegisterEntryOptions } from './types.js';
export { CATEGORY_DIRS, CATEGORY_EXT } from './types.js';
export { getUserCategoryDir, getProjectRoot, getProjectCategory, getManifestPath, getLayeredSourceDirs } from './paths.js';
export { readManifest, writeManifest, ensureManifest, addEntriesToManifest, removeEntriesFromManifest, updateAicoreMeta, findOverrides } from './manifest.js';
export { collectLayeredFiles, collectLayeredSkillDirs, getAllSourceDirs } from './layered-loader.js';
export { scanAgentDir, loadAgentFile, registerAgentFile, registerAgentDir, listRegisteredAgents, unregisterAgent } from './agent-registry.js';
export { scanSkillDir, isValidSkill, registerSkillDir, registerSkillsDir, listRegisteredSkills, unregisterSkill } from './skill-registry.js';
export { scanRuleDir, registerRuleFile, registerRuleDir, listRegisteredRules, unregisterRule } from './rule-registry.js';
export { scanHookDir, registerHookFile, registerHookDir, listRegisteredHooks, unregisterHook } from './hook-registry.js';
import type { RegisterResult, RegistryCategory } from './types.js';
/**
 * Register an external source into AICore/ (user-level).
 */
export declare function registerSource(aicoreRoot: string, options: {
    name: string;
    path: string;
    category: RegistryCategory;
}): RegisterResult;
//# sourceMappingURL=index.d.ts.map