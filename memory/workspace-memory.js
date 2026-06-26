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
// ── Paths ──
function memoryDir() {
    const dir = join(codesquadHome(), 'memory');
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    return dir;
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
//# sourceMappingURL=workspace-memory.js.map