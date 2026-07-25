import { existsSync, realpathSync, statSync } from 'fs';
import { join, resolve } from 'path';
/** Resolve and validate the workspace once at the application boundary. */
export function createWorkspaceContext(projectPath) {
    const candidate = resolve(projectPath);
    if (!existsSync(candidate) || !statSync(candidate).isDirectory()) {
        throw new Error('Workspace must be an existing directory');
    }
    const projectRoot = realpathSync.native(candidate);
    return { projectRoot, codesquadDir: join(projectRoot, '.codesquad') };
}
//# sourceMappingURL=workspace-context.js.map