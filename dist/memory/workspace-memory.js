/**
 * Workspace memory file system — MEMORY.md index + daily logs.
 *
 * References:
 *   Claude Code src/memdir/memdir.ts
 *
 * Structure:
 *   .codesquad/memory/
 *   ├── MEMORY.md           — index file (one pointer per line)
 *   ├── YYYY-MM-DD.md       — daily log (append-only)
 *   └── [topic].md          — standalone memory files
 *
 * Phase 5.2
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { codesquadHome } from '../chat/storage.js';
import { CODESQUAD_USER_ROOT } from '../core/paths.js';
/**
 * Get the project-scoped memory directory.
 * Uses codesquadHome() which resolves to projectRoot/.codesquad/ when set.
 */
function projectMemoryDir() {
    const dir = join(codesquadHome(), 'memory');
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    return dir;
}
/**
 * Get the global (user-level) memory directory.
 * Always resolves to ~/.codesquad/memory/, independent of current project.
 */
function globalMemoryDir() {
    const dir = join(CODESQUAD_USER_ROOT, 'memory');
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    return dir;
}
/** Resolve memory directory by scope. */
export function getMemoryDirForScope(scope) {
    return scope === 'global' ? globalMemoryDir() : projectMemoryDir();
}
// ── Legacy (project-only) backward compat ──
function memoryDir() {
    return projectMemoryDir();
}
function memoryIndexPath() {
    return join(memoryDir(), 'MEMORY.md');
}
function dailyLogPath(date) {
    const d = date || today();
    return join(memoryDir(), `${d}.md`);
}
function today() {
    return new Date().toISOString().slice(0, 10);
}
// ── MEMORY.md Index ──
/**
 * Read the MEMORY.md index.
 * Returns an array of { title, file, description } entries.
 */
export function readMemoryIndex() {
    const indexPath = memoryIndexPath();
    if (!existsSync(indexPath))
        return [];
    const content = readFileSync(indexPath, 'utf-8');
    const entries = [];
    for (const line of content.split('\n')) {
        // Format: - [Title](file.md) — description
        const match = line.match(/^-\s*\[([^\]]+)\]\(([^)]+)\)\s*[-—]\s*(.+)$/);
        if (match) {
            entries.push({
                title: match[1].trim(),
                file: match[2].trim(),
                description: match[3].trim(),
            });
        }
    }
    return entries;
}
/**
 * Add an entry to the MEMORY.md index.
 */
export function addMemoryEntry(title, file, description) {
    const indexPath = memoryIndexPath();
    const entries = readMemoryIndex();
    // Check for duplicates
    if (entries.some((e) => e.file === file))
        return;
    entries.push({ title, file, description });
    // Write back
    const lines = entries.map((e) => `- [${e.title}](${e.file}) — ${e.description}`);
    writeFileSync(indexPath, lines.join('\n') + '\n', 'utf-8');
}
// ── Daily Log ──
/**
 * Check if today's daily log exists.
 */
export function dailyLogExists(date) {
    return existsSync(dailyLogPath(date));
}
/**
 * Read today's daily log.
 */
export function readDailyLog(date) {
    const path = dailyLogPath(date);
    if (!existsSync(path))
        return '';
    return readFileSync(path, 'utf-8');
}
/**
 * Append to today's daily log.
 */
export function appendDailyLog(content, date) {
    const path = dailyLogPath(date);
    const existing = existsSync(path) ? readFileSync(path, 'utf-8') : '';
    const timestamp = new Date().toISOString();
    const entry = existing
        ? `${existing}\n\n## ${timestamp}\n\n${content}`
        : `# ${date || today()}\n\n## ${timestamp}\n\n${content}`;
    writeFileSync(path, entry, 'utf-8');
}
// ── Standalone Memory Files ──
/**
 * Write content to a standalone memory file.
 */
export function writeMemoryFile(filename, content) {
    const filePath = join(memoryDir(), filename);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf-8');
    return filePath;
}
/**
 * Read a standalone memory file.
 */
export function readMemoryFile(filename) {
    const filePath = join(memoryDir(), filename);
    if (!existsSync(filePath))
        return null;
    return readFileSync(filePath, 'utf-8');
}
// ── List / Cleanup ──
/**
 * List all memory files.
 */
export function listMemoryFiles() {
    const dir = memoryDir();
    try {
        return readdirSync(dir)
            .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
            .sort();
    }
    catch {
        return [];
    }
}
/**
 * Distill daily logs older than 30 days into MEMORY.md.
 */
export function distillOldLogs(maxAgeDays = 30) {
    const files = listMemoryFiles().filter((f) => f.match(/^\d{4}-\d{2}-\d{2}\.md$/));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    let distilled = 0;
    for (const file of files) {
        if (file < `${cutoffStr}.md`) {
            // This log is older than maxAgeDays
            // In a full implementation: read, summarize, add to MEMORY.md, delete
            // MVP: just count
            distilled++;
        }
    }
    return distilled;
}
// ── Capacity Protection (M3) ──
/** Maximum lines before truncation warning. */
const MAX_MEMORY_LINES = 200;
/** Maximum bytes before truncation (~25KB). */
const MAX_MEMORY_BYTES = 25 * 1024;
/**
 * Truncate memory content if it exceeds capacity limits.
 * Returns the truncated content and a warning message if truncation occurred.
 */
export function truncateEntrypointContent(content) {
    const lines = content.split('\n');
    const bytes = Buffer.byteLength(content, 'utf-8');
    if (lines.length <= MAX_MEMORY_LINES && bytes <= MAX_MEMORY_BYTES) {
        return { content, truncated: false };
    }
    let truncated = lines.slice(0, MAX_MEMORY_LINES).join('\n');
    while (Buffer.byteLength(truncated, 'utf-8') > MAX_MEMORY_BYTES) {
        const trimmedLines = truncated.split('\n');
        truncated = trimmedLines.slice(0, Math.floor(trimmedLines.length * 0.8)).join('\n');
    }
    return {
        content: truncated,
        truncated: true,
        warning: `[Memory truncated: ${lines.length} lines / ${(bytes / 1024).toFixed(0)}KB → ${truncated.split('\n').length} lines / ${(Buffer.byteLength(truncated, 'utf-8') / 1024).toFixed(0)}KB]`,
    };
}
/**
 * Ensure memory directory exists (creates if missing).
 */
export function ensureMemoryDirExists() {
    return memoryDir();
}
/** Get the (legacy project) memory directory path (creates if missing). */
export function getMemoryDir() {
    return memoryDir();
}
/** Get memory directory for a specific scope. */
export function getMemoryDirScoped(scope) {
    return getMemoryDirForScope(scope);
}
// ── Scope-aware I/O ──
/** Write content to a memory file in a specific scope. */
export function writeMemoryFileForScope(filename, content, scope) {
    const base = getMemoryDirForScope(scope);
    const filePath = join(base, filename);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf-8');
    return filePath;
}
/** Read a memory file from a specific scope. */
export function readMemoryFileForScope(filename, scope) {
    const filePath = join(getMemoryDirForScope(scope), filename);
    if (!existsSync(filePath))
        return null;
    return readFileSync(filePath, 'utf-8');
}
/** List memory files from a specific scope. */
export function listMemoryFilesForScope(scope) {
    const dir = getMemoryDirForScope(scope);
    try {
        return readdirSync(dir)
            .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
            .sort();
    }
    catch {
        return [];
    }
}
/** Read MEMORY.md index from a specific scope. */
export function readMemoryIndexForScope(scope) {
    const indexPath = join(getMemoryDirForScope(scope), 'MEMORY.md');
    if (!existsSync(indexPath))
        return [];
    const content = readFileSync(indexPath, 'utf-8');
    const entries = [];
    for (const line of content.split('\n')) {
        const match = line.match(/^-\s*\[([^\]]+)\]\(([^)]+)\)\s*[-—]\s*(.+)$/);
        if (match) {
            entries.push({ title: match[1].trim(), file: match[2].trim(), description: match[3].trim() });
        }
    }
    return entries;
}
/** Add an entry to MEMORY.md index in a specific scope. */
export function addMemoryEntryForScope(title, file, description, scope) {
    const indexPath = join(getMemoryDirForScope(scope), 'MEMORY.md');
    const entries = readMemoryIndexForScope(scope);
    if (entries.some((e) => e.file === file))
        return;
    entries.push({ title, file, description });
    const lines = entries.map((e) => `- [${e.title}](${e.file}) — ${e.description}`);
    writeFileSync(indexPath, lines.join('\n') + '\n', 'utf-8');
}
/** Read daily log from a specific scope. */
export function readDailyLogForScope(date, scope) {
    const d = date || new Date().toISOString().slice(0, 10);
    const path = join(getMemoryDirForScope(scope), `${d}.md`);
    if (!existsSync(path))
        return '';
    return readFileSync(path, 'utf-8');
}
/** Append to daily log in a specific scope. */
export function appendDailyLogForScope(content, scope, date) {
    const d = date || new Date().toISOString().slice(0, 10);
    const path = join(getMemoryDirForScope(scope), `${d}.md`);
    const existing = existsSync(path) ? readFileSync(path, 'utf-8') : '';
    const timestamp = new Date().toISOString();
    const entry = existing
        ? `${existing}\n\n## ${timestamp}\n\n${content}`
        : `# ${d}\n\n## ${timestamp}\n\n${content}`;
    writeFileSync(path, entry, 'utf-8');
}
//# sourceMappingURL=workspace-memory.js.map