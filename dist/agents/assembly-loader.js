/**
 * Assembly Loader — scans agent-assemblies/ directory and manages lazy body loading.
 *
 * Startup-time: loads only frontmatter metadata (lightweight).
 * First-use: resolves full AgentDef by merging with parent agent.
 * Caching: cached with mtime-based invalidation.
 *
 * References:
 *   Idea/tutrue/agent-assembly-design.md §3.2
 *   Idea/tutrue/.out/implementation-plan.md A-Task 3
 */
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { parseAssemblyFile, resolveAssemblyBody, } from './assembly-parser.js';
// ── Cache ──
const _bodyCache = new Map();
// ── loadAssemblyAgents ──
/**
 * Recursively scan a directory for `.assembly.md` files.
 * Returns lightweight metadata only (no body merging).
 */
export function loadAssemblyAgents(baseDir) {
    const results = [];
    try {
        _scanDir(baseDir, baseDir, results);
    }
    catch {
        // Directory doesn't exist or is inaccessible
    }
    return results;
}
function _scanDir(rootDir, currentDir, results) {
    let entries;
    try {
        entries = readdirSync(currentDir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        if (entry.isDirectory()) {
            _scanDir(rootDir, fullPath, results);
        }
        else if (entry.isFile() && entry.name.endsWith('.assembly.md')) {
            try {
                const meta = parseAssemblyFile(fullPath, { agentsDir: rootDir });
                results.push({
                    ...meta,
                    sourcePath: fullPath,
                });
            }
            catch {
                // Skip invalid assembly files
            }
        }
    }
}
// ── loadAssemblyBody ──
/**
 * Resolve an assembly agent's full body by merging with its parent.
 * Results are cached and invalidated on mtime changes.
 *
 * @param entry - The assembly metadata entry from loadAssemblyAgents
 * @param getParentAgent - Callback to retrieve the parent AgentDef by name
 */
export function loadAssemblyBody(entry, getParentAgent) {
    // Check cache
    const cacheKey = entry.sourcePath;
    const cached = _bodyCache.get(cacheKey);
    const assemblyMtime = _getMtime(entry.sourcePath);
    if (cached && cached.assemblyMtime === assemblyMtime) {
        // Assembly mtime unchanged — check parent mtime
        const parent = getParentAgent(entry.agent_parent);
        if (parent) {
            const parentMtime = _getMtime(parent); // AgentDef doesn't have a path — rely on assembly mtime alone
            if (cached.parentMtime === parentMtime) {
                return cached.resolved;
            }
        }
    }
    // Resolve fresh
    const parent = getParentAgent(entry.agent_parent);
    if (!parent) {
        throw new Error(`Assembly '${entry.name}': parent agent '${entry.agent_parent}' not found`);
    }
    const resolved = resolveAssemblyBody(entry, parent);
    // Cache
    _bodyCache.set(cacheKey, {
        resolved,
        parentMtime: _getMtime(parent),
        assemblyMtime,
    });
    return resolved;
}
// ── Helpers ──
function _getMtime(fileOrAgent) {
    if (typeof fileOrAgent === 'string') {
        try {
            return statSync(fileOrAgent).mtimeMs;
        }
        catch {
            return 0;
        }
    }
    // AgentDef — try to extract source path from extra
    const extra = fileOrAgent.extra;
    if (extra?.['sourcePath'] && typeof extra['sourcePath'] === 'string') {
        try {
            return statSync(extra['sourcePath']).mtimeMs;
        }
        catch {
            return Date.now();
        }
    }
    return Date.now();
}
/** Invalidate body cache for a specific assembly or all. */
export function invalidateAssemblyCache(sourcePath) {
    if (sourcePath) {
        _bodyCache.delete(sourcePath);
    }
    else {
        _bodyCache.clear();
    }
}
//# sourceMappingURL=assembly-loader.js.map