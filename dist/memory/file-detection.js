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
// ── Path patterns ──
const MEMORY_DIRECTORIES = [
    '.codesquad/memory',
    '.codesquad/agent-memory',
    '.codesquad/agent-memory-local',
    '.codesquad/auto-memory',
    '.codesquad/session-memory',
];
const MEMORY_FILE_PATTERNS = [
    // Bug Fix #10: Require /memory/ in path to avoid matching MEMORY.md in arbitrary dirs
    /\/memory\/MEMORY\.md$/,
    /\/\d{4}-\d{2}-\d{2}\.md$/,
    /\/session-memory\.md$/,
];
const NON_MEMORY_FILES = [
    'CODESQUAD.md',
    'CODEBUDDY.md',
    'AGENTS.md',
    'CLAUDE.md',
];
/**
 * Check if a file path belongs to the auto-managed memory system.
 * Includes: memory/ daily logs, agent memory, session memory.
 * Excludes: CLAUDE.md, CODEBUDDY.md, .codesquad/rules/*.md (user-managed).
 */
export function isAutoManagedMemoryFile(filePath) {
    // Check if path is inside a known memory directory using path-aware matching
    const normalizedPath = filePath.replace(/\\/g, '/');
    for (const dir of MEMORY_DIRECTORIES) {
        if (normalizedPath.includes('/' + dir + '/') || normalizedPath.endsWith('/' + dir))
            return true;
    }
    // Check if filename matches known memory patterns
    for (const pattern of MEMORY_FILE_PATTERNS) {
        if (pattern.test(filePath))
            return true;
    }
    // Exclude user-managed instruction files
    const basename = filePath.split(/[/\\]/).pop() || '';
    if (NON_MEMORY_FILES.includes(basename))
        return false;
    return false;
}
/**
 * Check if a directory path is a memory-related directory.
 */
export function isMemoryDirectory(dirPath) {
    return MEMORY_DIRECTORIES.some((d) => dirPath.endsWith(d) || dirPath.includes(d));
}
/**
 * Check if a shell command targets memory files (for UI collapse).
 */
export function isShellCommandTargetingMemory(command) {
    return MEMORY_DIRECTORIES.some((d) => command.includes(d)) ||
        MEMORY_FILE_PATTERNS.some((p) => p.test(command));
}
/**
 * Determine if a path is personal or team memory scope.
 */
export function memoryScopeForPath(filePath) {
    if (filePath.includes('auto-memory/personal') || filePath.includes('memory/')) {
        return 'personal';
    }
    if (filePath.includes('auto-memory/team')) {
        return 'team';
    }
    return null;
}
/**
 * Check if a glob pattern targets memory files.
 */
export function isAutoManagedMemoryPattern(pattern) {
    return MEMORY_DIRECTORIES.some((d) => pattern.includes(d)) ||
        pattern.includes('MEMORY.md') ||
        pattern.includes('session-memory.md');
}
//# sourceMappingURL=file-detection.js.map