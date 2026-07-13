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
import type { AgentDef } from '../adapters/types.js';
import type { AssemblyMeta } from './assembly-parser.js';
/** Extended metadata with source path (returned by loadAssemblyAgents). */
export interface AssemblyEntry extends AssemblyMeta {
    /** Absolute path to the .assembly.md file. */
    sourcePath: string;
}
/**
 * Recursively scan a directory for `.assembly.md` files.
 * Returns lightweight metadata only (no body merging).
 */
export declare function loadAssemblyAgents(baseDir: string): AssemblyEntry[];
/**
 * Resolve an assembly agent's full body by merging with its parent.
 * Results are cached and invalidated on mtime changes.
 *
 * @param entry - The assembly metadata entry from loadAssemblyAgents
 * @param getParentAgent - Callback to retrieve the parent AgentDef by name
 */
export declare function loadAssemblyBody(entry: AssemblyEntry, getParentAgent: (name: string) => AgentDef | undefined): AgentDef;
/** Invalidate body cache for a specific assembly or all. */
export declare function invalidateAssemblyCache(sourcePath?: string): void;
//# sourceMappingURL=assembly-loader.d.ts.map