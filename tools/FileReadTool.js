/**
 * FileReadTool — read files with line numbers, offset/limit pagination.
 *
 * References:
 *   Claude Code src/tools/FileReadTool/FileReadTool.ts (1184 lines)
 *
 * Phase 1.3
 */
import { readFileSync, statSync, existsSync } from 'fs';
import { extname, resolve, join } from 'path';
import { z } from 'zod';
import { buildTool } from './types.js';
import { recordFileRead, getSessionCache } from './file-state.js';
import { writeDiskCacheAsync } from '../cache/disk-cache.js';
// ── Schema ──
export const FileReadInputSchema = z.object({
    file_path: z.string().min(1).describe('Path to the file to read (relative to project root)'),
    offset: z.number().int().min(1).optional().describe('Line number to start reading from (1-indexed)'),
    limit: z.number().int().min(1).optional().default(200).describe('Maximum number of lines to read'),
});
// ── Constants ──
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const BINARY_THRESHOLD = 0.1; // >10% non-printable = binary
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const DEVICE_FILES = new Set([
    '/dev/null', '/dev/zero', '/dev/random', '/dev/urandom',
    '/dev/stdin', '/dev/stdout', '/dev/stderr',
]);
// ── Tool ──
export const FileReadTool = buildTool({
    name: 'Read',
    description: 'Read a file from the project, with optional line numbers and pagination.',
    searchHint: 'read file open view',
    inputSchema: FileReadInputSchema,
    maxResultSizeChars: 100_000,
    isReadOnly() {
        return true;
    },
    isConcurrencySafe() {
        return true;
    },
    isDestructive() {
        return false;
    },
    prompt() {
        return [
            '## File Read Tool',
            '',
            'Read files with line numbers for reference. Use this before writing or editing files.',
            '',
            '- `file_path` (required): Path relative to project root',
            '- `offset` (optional): Line number to start from (default: 1)',
            '- `limit` (optional): Max lines to read (default: 200, max: 500)',
            '',
            'Line numbers are shown as `LINE:content` for easy reference in subsequent edits.',
            'Large files should be read in pages using offset/limit.',
            'The tool blocks binary files, device files, and files > 5MB.',
        ].join('\n');
    },
    descriptionFor(input) {
        const parts = [`Read \`${input.file_path}\``];
        if (input.offset)
            parts.push(` from line ${input.offset}`);
        if (input.limit && input.limit !== 200)
            parts.push(` (${input.limit} lines)`);
        return parts.join('');
    },
    validateInput(input, context) {
        let filePath = resolve(context.projectRoot, input.file_path);
        // If not found in project root and path starts with AICore/, try aicoreDir fallback
        if (!existsSync(filePath) && context.aicoreDir && !input.file_path.startsWith('..')) {
            // Strip leading AICore/ prefix since aicoreDir already points to the AICore directory
            const relPath = input.file_path.replace(/^AICore[\\/]/, '');
            const aicorePath = join(context.aicoreDir, relPath);
            if (existsSync(aicorePath)) {
                filePath = aicorePath;
            }
        }
        // Check outside both project root and aicore dir
        const isWithinProject = filePath.startsWith(context.projectRoot);
        const isWithinAicore = context.aicoreDir ? filePath.startsWith(context.aicoreDir) : false;
        if (!isWithinProject && !isWithinAicore && !input.file_path.startsWith('..')) {
            return {
                valid: false,
                message: 'File path must be within the project directory.',
                errorCode: 'PATH_OUTSIDE_PROJECT',
            };
        }
        // Check device files
        if (DEVICE_FILES.has(filePath)) {
            return { valid: false, message: 'Cannot read device files.', errorCode: 'DEVICE_FILE' };
        }
        // Check existence
        if (!existsSync(filePath)) {
            return {
                valid: false,
                message: `File not found: ${input.file_path}`,
                errorCode: 'ENOENT',
            };
        }
        // Check is file
        const stat = statSync(filePath);
        if (!stat.isFile()) {
            return { valid: false, message: 'Path is not a file.', errorCode: 'NOT_A_FILE' };
        }
        // Check size
        if (stat.size > MAX_FILE_SIZE_BYTES) {
            return {
                valid: false,
                message: `File too large (${formatSize(stat.size)}). Max: ${formatSize(MAX_FILE_SIZE_BYTES)}. Use offset/limit to read in pages.`,
                errorCode: 'FILE_TOO_LARGE',
            };
        }
        return { valid: true };
    },
    checkPermissions(_input, _context) {
        // Read is always allowed
        return { behavior: 'allow' };
    },
    async call(input, context) {
        let filePath = resolve(context.projectRoot, input.file_path);
        // Fallback to aicoreDir if not found in project root
        if (!existsSync(filePath) && context.aicoreDir && !input.file_path.startsWith('..')) {
            const relPath = input.file_path.replace(/^AICore[\\/]/, '');
            const aicorePath = join(context.aicoreDir, relPath);
            if (existsSync(aicorePath))
                filePath = aicorePath;
        }
        const ext = extname(filePath).toLowerCase();
        // ── Image files ──
        if (SUPPORTED_IMAGE_EXTENSIONS.has(ext)) {
            return readImageFile(filePath, input.file_path);
        }
        // ── Text files ──
        const content = readFileSync(filePath, 'utf-8');
        const allLines = content.split('\n');
        // Detect binary
        if (isBinary(allLines)) {
            // Try reading as image even if extension isn't standard
            if (IMAGE_EXTENSIONS.has(ext)) {
                return readImageFile(filePath, input.file_path);
            }
            return {
                toolCallId: '',
                output: { lines: [], totalLines: allLines.length, filePath: input.file_path },
                content: `[Binary file] Cannot display binary content. File: ${input.file_path} (${formatSize(statSync(filePath).size)})`,
            };
        }
        // Record read for Read-then-Write enforcement
        recordFileRead(getSessionCache(), filePath, content);
        // Write to DiskCache (fire-and-forget, non-blocking)
        // write() already sets _accessedAt to Date.now(), no separate touch needed
        const mtime = statSync(filePath).mtimeMs;
        writeDiskCacheAsync(filePath, content, mtime, allLines);
        // Paginate
        const offset = (input.offset ?? 1) - 1;
        const limit = input.limit ?? 200;
        const page = allLines.slice(offset, offset + limit);
        const output = formatReadOutput(page, offset, allLines.length, input.file_path);
        return {
            toolCallId: '',
            output: { lines: allLines, totalLines: allLines.length, filePath: input.file_path },
            content: output,
        };
    },
});
// ── Helpers ──
function isBinary(lines) {
    const sample = lines.slice(0, 100).join('');
    if (sample.length === 0)
        return false;
    const nonPrintable = sample.split('').filter((c) => {
        const code = c.charCodeAt(0);
        return code < 32 && code !== 9 && code !== 10 && code !== 13;
    }).length;
    return nonPrintable / sample.length > BINARY_THRESHOLD;
}
function formatReadOutput(lines, startLine, totalLines, filePath) {
    if (lines.length === 0 && totalLines === 0) {
        return `[Empty file] ${filePath}`;
    }
    const result = [];
    const lineNumWidth = String(startLine + lines.length).length;
    for (let i = 0; i < lines.length; i++) {
        const num = String(startLine + i + 1).padStart(lineNumWidth, ' ');
        result.push(`${num}:${lines[i] || ''}`);
    }
    if (totalLines > (startLine + lines.length)) {
        result.push(`\n... (${totalLines - startLine - lines.length} more lines)`);
    }
    return result.join('\n');
}
function readImageFile(absolutePath, relativePath) {
    const buffer = readFileSync(absolutePath);
    const base64 = buffer.toString('base64');
    const ext = extname(absolutePath).toLowerCase();
    const mime = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
    }[ext] || 'image/png';
    const dataUrl = `data:${mime};base64,${base64}`;
    // Only include data URL if size is reasonable (< 500KB after base64)
    if (base64.length > 500_000) {
        return {
            toolCallId: '',
            output: { lines: [], totalLines: 0, filePath: relativePath },
            content: `[Image] ${relativePath} (${formatSize(buffer.length)}) — too large for inline display. The file exists and is readable.`,
        };
    }
    return {
        toolCallId: '',
        output: { lines: [], totalLines: 0, filePath: relativePath },
        content: `[Image] ${relativePath}\n${dataUrl}`,
    };
}
function formatSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
//# sourceMappingURL=FileReadTool.js.map