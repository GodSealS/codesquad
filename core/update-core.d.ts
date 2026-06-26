/**
 * Update Core
 *
 * Regenerate agent/skill files from canonical sources.
 * Phase 7.5: Enhanced with lockfile-based incremental updates.
 * Supports --force, --preserve, --dry-run modes.
 */
export interface UpdateOptions {
    targetPath: string;
    tools?: string;
    force?: boolean;
    preserve?: boolean;
    dryRun?: boolean;
    diff?: boolean;
}
/**
 * Regenerate files for bound tools in the target project.
 */
export declare function updateProject(options: UpdateOptions): Promise<void>;
//# sourceMappingURL=update-core.d.ts.map