/**
 * Models Config Manager
 *
 * Read/write models.config.yaml with per-agent, per-skill, and batch model mappings.
 */
import type { ModelOverride, ApiEndpoint } from '../adapters/types.js';
import { type ModelsConfig } from '../schemas/config.schema.js';
/** Validate that all source references in agents/skills point to existing api.sources */
export declare function validateSourceReferences(config: ModelsConfig): string[];
/** Load models.config.yaml from a project directory */
export declare function loadModelsConfig(projectPath: string): ModelsConfig;
/** Save models.config.yaml to a project directory */
export declare function saveModelsConfig(projectPath: string, config: ModelsConfig): void;
/** Merge multiple tool default mappings: first-selected tool wins */
export declare function computeToolDefaultModels(toolIds: string[]): ModelsConfig;
/** Load existing or auto-generate defaults (only called during init, not bind) */
export declare function loadOrInitModelsConfig(projectPath: string, toolIds: string[]): ModelsConfig;
/** Set a per-agent model override */
export declare function setAgentModel(projectPath: string, agentName: string, override: ModelOverride): void;
/** Set a per-skill model override */
export declare function setSkillModel(projectPath: string, skillName: string, override: ModelOverride): void;
/** Set a batch pattern mapping */
export declare function setBatchMapping(projectPath: string, pattern: string, model: string): void;
/** Set the default fallback model */
export declare function setDefaultModel(projectPath: string, model: string | null): void;
/** Reset models.config.yaml: restore tool-appropriate defaults if tools known, else empty */
export declare function resetModelsConfig(projectPath: string): void;
/** Set/update a single scalar field on api.sources[name] (provider, baseUrl, apiKey only; use setApiSourceHeaders for headers) */
export declare function setApiSourceField(projectPath: string, sourceName: string, fieldName: Exclude<keyof ApiEndpoint, 'headers'>, value: string | undefined): void;
/** Set/update headers on api.sources[name] (replaces entire headers object) */
export declare function setApiSourceHeaders(projectPath: string, sourceName: string, headers: Record<string, string>): void;
/** Delete an entire api.source entry */
export declare function removeApiSource(projectPath: string, sourceName: string): void;
/**
 * Import model config from an external YAML file, merging into the project's
 * models.config.yaml. The import file uses the same schema as models.config.yaml.
 *
 * Merge strategy (per-section):
 *   agents / skills / batch  — deep merge: new entries are added, existing keys are overwritten
 *   default                  — overwritten if non-null in import
 *   api.sources              — deep merge: new sources added, existing sources merged by field
 */
export declare function importModelsConfig(projectPath: string, importFilePath: string): {
    added: number;
    warnings: string[];
};
/**
 * Write a commented template models.config.yaml to the target path.
 * Does NOT overwrite an existing file unless force=true.
 */
export declare function writeModelsConfigTemplate(projectPath: string, force?: boolean): boolean;
//# sourceMappingURL=models.d.ts.map