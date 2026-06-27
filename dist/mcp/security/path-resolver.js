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
import { resolve, normalize, relative, isAbsolute, sep } from 'path';
import { loadMcpConfig } from '../config.js';
import { McpErrorCode, mcpError } from '../errors.js';
import { logger } from '../observability/logger.js';
let _cachedConfig = null;
/** Initialize with config (call once) */
export function initPathResolver(config) {
    _cachedConfig = config;
}
/** Get current config or load fresh */
function getConfig(projectRoot) {
    return _cachedConfig ?? loadMcpConfig(projectRoot);
}
/**
 * Resolve and validate a file path.
 *
 * @param requestedPath - The path as provided by the caller (relative or absolute)
 * @param workspaceRoot  - The project workspace root
 * @param operation      - 'read' or 'write' (write only allowed in workspace)
 *
 * @throws McpError if path violates workspace boundary and enforce_boundary is true
 */
export function resolveSafePath(requestedPath, workspaceRoot, operation = 'read') {
    const config = getConfig(workspaceRoot);
    const absWorkspace = resolve(workspaceRoot);
    // Resolve the requested path
    // If relative, resolve against workspace; if absolute, keep as-is
    const resolved = isAbsolute(requestedPath)
        ? resolve(requestedPath)
        : resolve(absWorkspace, requestedPath);
    const normalized = normalize(resolved);
    // Check 1: Workspace boundary (primary)
    // Use trailing separator to prevent prefix confusion (e.g. /home/user/project-evil)
    const normalizedWorkspace = normalize(absWorkspace) + sep;
    if (normalized === normalize(absWorkspace) || normalized.startsWith(normalizedWorkspace)) {
        return { absolute: normalized, allowed: true, boundary: 'workspace' };
    }
    // Check 2: Read-only extras (only for read operations)
    if (operation === 'read' && config.workspace.read_only_extras) {
        for (const extra of config.workspace.read_only_extras) {
            const resolvedExtra = resolve(extra);
            const normalizedExtra = normalize(resolvedExtra) + sep;
            if (normalized === normalize(resolvedExtra) || normalized.startsWith(normalizedExtra)) {
                return { absolute: normalized, allowed: true, boundary: 'read_only' };
            }
        }
    }
    // Path traversal detected
    const violation = `Path '${requestedPath}' resolves outside workspace boundary:
  Resolved: ${normalized}
  Workspace: ${absWorkspace}
  Operation: ${operation}`;
    logger.warn(violation, 'path-resolver', {
        requested: requestedPath,
        resolved: normalized,
        workspace: absWorkspace,
        operation,
    });
    if (config.workspace.enforce_boundary) {
        throw mcpError(McpErrorCode.WORKSPACE_VIOLATION, violation, {
            requested: requestedPath,
            resolved: normalized,
            workspace: absWorkspace,
        });
    }
    // Boundary enforcement disabled — warn but allow
    return {
        absolute: normalized,
        allowed: false,
        boundary: 'none',
        violation,
    };
}
/**
 * Batch validate multiple paths (for context injection with references)
 */
export function resolveSafePaths(requestedPaths, workspaceRoot, operation = 'read') {
    const results = [];
    const violations = [];
    for (const p of requestedPaths) {
        try {
            results.push(resolveSafePath(p, workspaceRoot, operation));
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            violations.push(msg);
            results.push({
                absolute: resolve(workspaceRoot, p),
                allowed: false,
                boundary: 'none',
                violation: msg,
            });
        }
    }
    if (violations.length > 0 && getConfig(workspaceRoot).workspace.enforce_boundary) {
        throw mcpError(McpErrorCode.WORKSPACE_VIOLATION, `${violations.length} path(s) violated workspace boundary`, { violations });
    }
    return results;
}
/**
 * Quick check: is a path safe without throwing?
 * Useful for pre-validation before expensive operations.
 */
export function isPathSafe(requestedPath, workspaceRoot, operation = 'read') {
    try {
        const result = resolveSafePath(requestedPath, workspaceRoot, operation);
        return result.allowed;
    }
    catch {
        return false;
    }
}
/**
 * Get relative path from workspace root (for display/reporting)
 */
export function relativeToWorkspace(absolutePath, workspaceRoot) {
    const rel = relative(resolve(workspaceRoot), resolve(absolutePath));
    return rel.startsWith('..') ? absolutePath : rel;
}
//# sourceMappingURL=path-resolver.js.map