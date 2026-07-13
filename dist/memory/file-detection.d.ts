/**
 * Memory file/directory detection utilities.
 *
 * Used by UI collapse, tool permissions, and telemetry to identify
 * auto-managed memory files vs user-managed instruction files.
 *
 * References:
 *   Claude Code src/utils/memoryFileDetection.ts
 *   Idea/tutrue/memory-system-design.md §2.3.7
 */
/**
 * Check if a file path belongs to the auto-managed memory system.
 * Includes: memory/ daily logs, agent memory, session memory.
 * Excludes: CLAUDE.md, CODEBUDDY.md, .codesquad/rules/*.md (user-managed).
 */
export declare function isAutoManagedMemoryFile(filePath: string): boolean;
/**
 * Check if a directory path is a memory-related directory.
 */
export declare function isMemoryDirectory(dirPath: string): boolean;
/**
 * Check if a shell command targets memory files (for UI collapse).
 */
export declare function isShellCommandTargetingMemory(command: string): boolean;
/**
 * Determine if a path is personal or team memory scope.
 */
export declare function memoryScopeForPath(filePath: string): 'personal' | 'team' | null;
/**
 * Check if a glob pattern targets memory files.
 */
export declare function isAutoManagedMemoryPattern(pattern: string): boolean;
//# sourceMappingURL=file-detection.d.ts.map