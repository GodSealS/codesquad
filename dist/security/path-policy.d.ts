/** Shared filesystem boundary checks for workspace-scoped operations. */
/**
 * Resolve a user-supplied path and require it to remain inside a workspace.
 * Existing files are resolved through symlinks. For new files, the nearest
 * existing parent is resolved so a symlinked parent cannot escape the root.
 */
export declare function resolveWorkspacePath(workspaceRoot: string, requestedPath: string): string;
/** True when a path (including the workspace root itself) stays in the workspace. */
export declare function isWorkspacePath(workspaceRoot: string, requestedPath: string): boolean;
//# sourceMappingURL=path-policy.d.ts.map