/**
 * Registry path resolution — two-layer .codesquad directories.
 *
 * User-level:  AICore/agents/ skills/ rules/ hooks/  (built-in, external CLIs register here)
 * Project-level: <cwd>/.codesquad/agents/ skills/ rules/ hooks/  (project-specific overrides)
 *
 * Priority: Project > User
 */
import { join } from 'path';
import { CATEGORY_DIRS } from './types.js';
/**
 * Get the user-level category directory (inside AICore).
 * This is where built-in and externally-registered content lives.
 */
export function getUserCategoryDir(aicoreRoot, category) {
    return join(aicoreRoot, CATEGORY_DIRS[category]);
}
/**
 * Get the project-level .codesquad root.
 */
export function getProjectRoot(cwd) {
    return join(cwd ?? process.cwd(), '.codesquad');
}
/**
 * Get the project-level .codesquad category directory.
 */
export function getProjectCategory(category, cwd) {
    return join(getProjectRoot(cwd), CATEGORY_DIRS[category]);
}
/**
 * Get the manifest path for tracking external registrations.
 * Stored at AICore/.codesquad/manifest.yaml.
 */
export function getManifestPath(aicoreRoot) {
    return join(aicoreRoot, '.codesquad', 'manifest.yaml');
}
/**
 * Get source directories for a category in priority order (project > user).
 */
export function getLayeredSourceDirs(category, aicoreRoot, cwd) {
    return [
        getUserCategoryDir(aicoreRoot, category), // User-level (base)
        getProjectCategory(category, cwd), // Project-level (override)
    ];
}
//# sourceMappingURL=paths.js.map