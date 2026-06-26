/**
 * Update Command
 *
 * codesquad update [path] --tools <tools> --force --preserve --dry-run
 * Regenerates agent/skill files with lockfile-based incremental updates.
 * Phase 7.5: Enhanced with lockfile support.
 */
export declare function handleUpdate(targetPath?: string, options?: {
    tools?: string;
    force?: boolean;
    preserve?: boolean;
    dryRun?: boolean;
    diff?: boolean;
}): Promise<void>;
//# sourceMappingURL=update.d.ts.map