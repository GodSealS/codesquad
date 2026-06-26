/**
 * Init Command
 *
 * codesquad init [path] --tools <tools> [--force]
 * Initializes CodeSquad in a project directory.
 */
import { initProject } from '../core/init-core.js';
export async function handleInit(targetPath, options) {
    await initProject({
        targetPath: targetPath ?? '.',
        tools: options?.tools,
        force: options?.force,
    });
}
//# sourceMappingURL=init.js.map