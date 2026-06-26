/**
 * Project Config Manager
 *
 * Centralized read/write for codesquad.config.yaml.
 * Replaces inline config handling scattered across init-core and setup-engine-core.
 */
import { type ProjectConfig } from '../schemas/config.schema.js';
/** Path to project config file within a project directory */
export declare function configPath(projectDir: string): string;
/** Load codesquad.config.yaml, returning defaults if it doesn't exist */
export declare function loadProjectConfig(projectDir: string): ProjectConfig;
/** Write codesquad.config.yaml */
export declare function saveProjectConfig(projectDir: string, config: ProjectConfig): void;
/** Get the list of bound tool IDs */
export declare function getBoundTools(projectDir: string): string[];
/** Set the bound tools list and save */
export declare function setBoundTools(projectDir: string, tools: string[]): void;
/** Update engine configuration */
export declare function setEngineConfig(projectDir: string, engine: string, version: string): void;
/** Check if codesquad.config.yaml exists */
export declare function hasProjectConfig(projectDir: string): boolean;
//# sourceMappingURL=project-config.d.ts.map