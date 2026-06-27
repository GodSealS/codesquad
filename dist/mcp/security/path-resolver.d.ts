/**
 * Path Resolver — Workspace Boundary Enforcement
 *
 * Validates that all file operations stay within the project workspace.
 * Prevents agents from reading/writing outside allowed directories.
 *
 * Supports:
 *   - Primary workspace root (enforced)
 *   - Read-only extra paths (configurable, for shared libs/docs)
 *   - Path traversal detection
 */
import { type McpConfig } from '../config.js';
/** Result of path safety check */
export interface ResolvedPath {
    /** Absolute resolved path */
    absolute: string;
    /** Whether the path is within the allowed boundary */
    allowed: boolean;
    /** The boundary that matched (workspace | read_only_extra) */
    boundary: 'workspace' | 'read_only' | 'none';
    /** Violation detail (if not allowed) */
    violation?: string;
}
/** Initialize with config (call once) */
export declare function initPathResolver(config: McpConfig): void;
/**
 * Resolve and validate a file path.
 *
 * @param requestedPath - The path as provided by the caller (relative or absolute)
 * @param workspaceRoot  - The project workspace root
 * @param operation      - 'read' or 'write' (write only allowed in workspace)
 *
 * @throws McpError if path violates workspace boundary and enforce_boundary is true
 */
export declare function resolveSafePath(requestedPath: string, workspaceRoot: string, operation?: 'read' | 'write'): ResolvedPath;
/**
 * Batch validate multiple paths (for context injection with references)
 */
export declare function resolveSafePaths(requestedPaths: string[], workspaceRoot: string, operation?: 'read' | 'write'): ResolvedPath[];
/**
 * Quick check: is a path safe without throwing?
 * Useful for pre-validation before expensive operations.
 */
export declare function isPathSafe(requestedPath: string, workspaceRoot: string, operation?: 'read' | 'write'): boolean;
/**
 * Get relative path from workspace root (for display/reporting)
 */
export declare function relativeToWorkspace(absolutePath: string, workspaceRoot: string): string;
//# sourceMappingURL=path-resolver.d.ts.map