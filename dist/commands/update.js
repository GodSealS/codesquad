/**
 * Update Command
 *
 * codesquad update [path] --tools <tools> --force --preserve --dry-run
 * Regenerates agent/skill files with lockfile-based incremental updates.
 * Phase 7.5: Enhanced with lockfile support.
 */
import { updateProject } from '../core/update-core.js';
export async function handleUpdate(targetPath, options) {
    await updateProject({
        targetPath: targetPath ?? '.',
        tools: options?.tools,
        force: options?.force,
        preserve: options?.preserve,
        dryRun: options?.dryRun,
        diff: options?.diff,
    });
}
//# sourceMappingURL=update.js.map