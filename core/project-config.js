/**
 * Project Config Manager
 *
 * Centralized read/write for codesquad.config.yaml.
 * Replaces inline config handling scattered across init-core and setup-engine-core.
 */
import { join } from 'path';
import { existsSync } from 'fs';
import { readYaml, writeYaml } from '../utils/yaml.js';
import { DEFAULT_PROJECT_CONFIG } from '../schemas/config.schema.js';
/** Path to project config file within a project directory */
export function configPath(projectDir) {
    return join(projectDir, 'codesquad.config.yaml');
}
/** Load codesquad.config.yaml, returning defaults if it doesn't exist */
export function loadProjectConfig(projectDir) {
    const cfg = readYaml(configPath(projectDir));
    if (!cfg)
        return { ...DEFAULT_PROJECT_CONFIG };
    return {
        version: cfg.version ?? DEFAULT_PROJECT_CONFIG.version,
        tools: cfg.tools ?? DEFAULT_PROJECT_CONFIG.tools,
        engine: {
            name: cfg.engine?.name ?? DEFAULT_PROJECT_CONFIG.engine.name,
            version: cfg.engine?.version ?? DEFAULT_PROJECT_CONFIG.engine.version,
        },
        generation: {
            overwriteOnUpdate: cfg.generation?.overwriteOnUpdate ?? DEFAULT_PROJECT_CONFIG.generation.overwriteOnUpdate,
            skipSettings: cfg.generation?.skipSettings ?? DEFAULT_PROJECT_CONFIG.generation.skipSettings,
        },
    };
}
/** Write codesquad.config.yaml */
export function saveProjectConfig(projectDir, config) {
    writeYaml(configPath(projectDir), config);
}
/** Get the list of bound tool IDs */
export function getBoundTools(projectDir) {
    const cfg = loadProjectConfig(projectDir);
    return cfg.tools ?? [];
}
/** Set the bound tools list and save */
export function setBoundTools(projectDir, tools) {
    const cfg = loadProjectConfig(projectDir);
    cfg.tools = tools;
    saveProjectConfig(projectDir, cfg);
}
/** Update engine configuration */
export function setEngineConfig(projectDir, engine, version) {
    const cfg = loadProjectConfig(projectDir);
    cfg.engine = { name: engine, version };
    saveProjectConfig(projectDir, cfg);
}
/** Check if codesquad.config.yaml exists */
export function hasProjectConfig(projectDir) {
    return existsSync(configPath(projectDir));
}
//# sourceMappingURL=project-config.js.map