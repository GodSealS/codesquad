/**
 * Registry path resolution — two-layer .codesquad directories.
 *
 * User-level:  AICore/agents/ skills/ rules/ hooks/  (built-in, external CLIs register here)
 * Project-level: <cwd>/.codesquad/agents/ skills/ rules/ hooks/  (project-specific overrides)
 *
 * Priority: Project > User
 */
import type { RegistryCategory } from './types.js';
/**
 * Get the user-level category directory (inside AICore).
 * This is where built-in and externally-registered content lives.
 */
export declare function getUserCategoryDir(aicoreRoot: string, category: RegistryCategory): string;
/**
 * Get the project-level .codesquad root.
 */
export declare function getProjectRoot(cwd?: string): string;
/**
 * Get the project-level .codesquad category directory.
 */
export declare function getProjectCategory(category: RegistryCategory, cwd?: string): string;
/**
 * Get the manifest path for tracking external registrations.
 * Stored at AICore/.codesquad/manifest.yaml.
 */
export declare function getManifestPath(aicoreRoot: string): string;
/**
 * Get source directories for a category in priority order (project > user).
 */
export declare function getLayeredSourceDirs(category: RegistryCategory, aicoreRoot: string, cwd?: string): string[];
//# sourceMappingURL=paths.d.ts.map