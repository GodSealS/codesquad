/**
 * FileReadTool — read files with line numbers, offset/limit pagination.
 *
 * References:
 *   Claude Code src/tools/FileReadTool/FileReadTool.ts (1184 lines)
 *
 * Phase 1.3
 */
import { readFileSync, statSync, existsSync, realpathSync } from 'fs';
import { extname, resolve, join } from 'path';
import { z } from 'zod';
import { buildTool } from './types.js';
import { recordFileRead, getSessionCache } from './file-state.js';
import { writeDiskCacheAsync } from '../cache/disk-cache.js';
import { fileExists, fileRead } from '../embedded/virtual-fs.js';
import { isProtectedAicorePath, CODESQUAD_USER_ROOT } from '../core/paths.js';
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
// ── .codesquad/ path resolution ──
/**
 * Resolve a .codesquad/ file path with 3-tier fallback:
 *   1. ${project}/.codesquad/<relativePath>   — project-level
 *   2. ${user}/.codesquad/<relativePath>       — user-level (~)
 *   3. ${CLI}/.codesquad/<relativePath>        — CLI package (aicoreDir)
 *
 * Returns the resolved absolute path, or null if not found in any tier.
 * Uses fileExists() which is virtual-fs aware (handles embedded content).
 */
function resolveCodesquadPath(relativePath, projectRoot, aicoreDir) {
    // Tier 1: Project
    const projectPath = join(projectRoot, '.codesquad', relativePath);
    if (fileExists(projectPath))
        return projectPath;
    // Tier 2: User (~/.codesquad/)
    const userPath = join(CODESQUAD_USER_ROOT, relativePath);
    if (fileExists(userPath))
        return userPath;
    // Tier 3: CLI package (.codesquad bundled with the CLI)
    if (aicoreDir) {
        const aicorePath = join(aicoreDir, relativePath);
        if (fileExists(aicorePath))
            return aicorePath;
    }
    return null;
}
// ── Tool ──
export const FileReadTool = buildTool({
    name: 'Read',
    description: 'Read a file from the project, with optional line numbers and pagination. Can be batched with other Read/Grep/Glob calls in one response.',
    searchHint: 'read file open view',
    inputSchema: FileReadInputSchema,
    maxResultSizeChars: 30_000, // ~7.5K tokens — prevents context explosion from large reads
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
        // ── 3-tier fallback for .codesquad/ paths ──
        // Project root → User home → CLI package
        const isCodesquadPath = input.file_path.startsWith('.codesquad/') || input.file_path.startsWith('.codesquad\\');
        if (!fileExists(filePath) && isCodesquadPath && !input.file_path.startsWith('..')) {
            const relPath = input.file_path.replace(/^.codesquad[\\/]/, '');
            const resolved = resolveCodesquadPath(relPath, context.projectRoot, context.aicoreDir);
            if (resolved)
                filePath = resolved;
        }
        // Bound-check: must be within project, user codesquad, or CLI aicore
        const isWithinProject = filePath.startsWith(context.projectRoot);
        const isWithinUserCodesquad = CODESQUAD_USER_ROOT ? filePath.startsWith(CODESQUAD_USER_ROOT) : false;
        const isWithinAicore = context.aicoreDir ? filePath.startsWith(context.aicoreDir) : false;
        if (!isWithinProject && !isWithinUserCodesquad && !isWithinAicore && !input.file_path.startsWith('..')) {
            return {
                valid: false,
                message: 'File path must be within the project directory.',
                errorCode: 'PATH_OUTSIDE_PROJECT',
            };
        }
        // Block reads from AICore-built-in .codesquad/agents/ and .codesquad/skills/
        // (NOT from project-level or user-level .codesquad/ — those are user-authored)
        if (context.aicoreDir && isProtectedAicorePath(filePath, context.aicoreDir, context.projectRoot)) {
            return {
                valid: false,
                message: 'Reading files from this directory is not permitted.',
                errorCode: 'PROTECTED_PATH',
            };
        }
        // Check device files
        if (DEVICE_FILES.has(filePath)) {
            return { valid: false, message: 'Cannot read device files.', errorCode: 'DEVICE_FILE' };
        }
        // Check existence (virtual-fs for .codesquad paths, disk for project files)
        if (!fileExists(filePath)) {
            return {
                valid: false,
                message: `File not found: ${input.file_path}`,
                errorCode: 'ENOENT',
            };
        }
        // 🔧 Fix: 区分虚拟文件和磁盘文件。Bun 编译模式下 .codesquad/ 路径
        // 不是 B:\~BUN\ 而是 B:\.codesquad\ → 不能用字符串匹配判断。
        // fileExists() 返回 true 但 existsSync() 返回 false → 虚拟文件，跳过 symlink/stat。
        const isRealDiskFile = existsSync(filePath);
        // Resolve symlinks to prevent path traversal (symlink → /etc/passwd bypass)
        // Only for real disk files — virtual/embedded files have no symlink risk.
        const isUserPath = CODESQUAD_USER_ROOT ? filePath.startsWith(CODESQUAD_USER_ROOT) : false;
        if (isRealDiskFile && !isUserPath) {
            try {
                const realPath = realpathSync(filePath);
                const safe = (isWithinProject && realPath.startsWith(context.projectRoot))
                    || (isWithinAicore && context.aicoreDir && realPath.startsWith(context.aicoreDir));
                if (!safe) {
                    return {
                        valid: false,
                        message: 'File path resolves outside the project directory (symlink traversal).',
                        errorCode: 'PATH_OUTSIDE_PROJECT',
                    };
                }
            }
            catch {
                return { valid: false, message: 'Broken symlink.', errorCode: 'ENOENT' };
            }
        }
        // stat only for real disk files — virtual files are always regular
        if (!isRealDiskFile)
            return { valid: true };
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
        // ── 3-tier fallback for .codesquad/ paths ──
        const isCodesquadPath = input.file_path.startsWith('.codesquad/') || input.file_path.startsWith('.codesquad\\');
        if (!fileExists(filePath) && isCodesquadPath && !input.file_path.startsWith('..')) {
            const relPath = input.file_path.replace(/^.codesquad[\\/]/, '');
            const resolved = resolveCodesquadPath(relPath, context.projectRoot, context.aicoreDir);
            if (resolved)
                filePath = resolved;
        }
        const ext = extname(filePath).toLowerCase();
        // ── Image files ──
        if (SUPPORTED_IMAGE_EXTENSIONS.has(ext)) {
            return readImageFile(filePath, input.file_path);
        }
        // ── Text files ──
        // Use virtual-fs for reading (supports embedded .codesquad in published builds)
        const content = fileRead(filePath);
        const allLines = content.split('\n');
        // Detect whether the file lives on real disk (needed for stat/mtime)
        // 🔧 Fix: 用 existsSync 而非 ~BUN/ 字符串匹配，覆盖 B:\.codesquad\ 等虚拟路径
        const onRealDisk = existsSync(filePath);
        // Detect binary
        if (isBinary(allLines)) {
            // Try reading as image even if extension isn't standard
            if (IMAGE_EXTENSIONS.has(ext)) {
                return readImageFile(filePath, input.file_path);
            }
            const sizeStr = onRealDisk ? formatSize(statSync(filePath).size) : 'embedded';
            return {
                toolCallId: '',
                output: { lines: [], totalLines: allLines.length, filePath: input.file_path },
                content: `[Binary file] Cannot display binary content. File: ${input.file_path} (${sizeStr})`,
            };
        }
        // Record read for Read-then-Write enforcement
        recordFileRead(getSessionCache(), filePath, content);
        // Write to DiskCache (fire-and-forget, non-blocking)
        // write() already sets _accessedAt to Date.now(), no separate touch needed
        if (onRealDisk) {
            const mtime = statSync(filePath).mtimeMs;
            writeDiskCacheAsync(filePath, content, mtime, allLines);
        }
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