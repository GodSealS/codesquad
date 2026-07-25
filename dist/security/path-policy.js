/** Shared filesystem boundary checks for workspace-scoped operations. */
import { existsSync, realpathSync } from 'fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'path';
function isWithin(root, target) {
    const rel = relative(root, target);
    return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}
function realPath(path) {
    return realpathSync.native(path);
}
/**
 * Resolve a user-supplied path and require it to remain inside a workspace.
 * Existing files are resolved through symlinks. For new files, the nearest
 * existing parent is resolved so a symlinked parent cannot escape the root.
 */
export function resolveWorkspacePath(workspaceRoot, requestedPath) {
    if (typeof requestedPath !== 'string' || requestedPath.length === 0) {
        throw new Error('A non-empty path is required');
    }
    const root = realPath(resolve(workspaceRoot));
    const target = resolve(root, requestedPath);
    if (!isWithin(root, target)) {
        throw new Error('Path traversal detected: path resolves outside the workspace');
    }
    let existing = target;
    while (!existsSync(existing)) {
        const parent = dirname(existing);
        if (parent === existing) {
            throw new Error('Path traversal detected: no existing parent inside the workspace');
        }
        existing = parent;
    }
    if (!isWithin(root, realPath(existing))) {
        throw new Error('Path traversal detected: path resolves outside the workspace');
    }
    return target;
}
/** True when a path (including the workspace root itself) stays in the workspace. */
export function isWorkspacePath(workspaceRoot, requestedPath) {
    try {
        resolveWorkspacePath(workspaceRoot, requestedPath);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=path-policy.js.map