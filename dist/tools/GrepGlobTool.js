/**
 * GrepTool + GlobTool — text search and file pattern matching.
 *
 * References:
 *   Claude Code src/tools/GrepTool/GrepTool.ts (577 lines)
 *   Claude Code src/tools/GlobTool/GlobTool.ts (198 lines)
 *
 * Phase 1.6
 */
import { readFileSync, statSync } from 'fs';
import { resolve, relative } from 'path';
import { z } from 'zod';
import { buildTool } from './types.js';
import fastGlob from 'fast-glob';
import { writeDiskCacheAsync } from '../cache/disk-cache.js';
import { fileExists } from '../embedded/virtual-fs.js';
import { isProtectedAicorePath } from '../core/paths.js';
// ════════════════════════════════════════════════════════════════
// GrepTool
// ════════════════════════════════════════════════════════════════
export const GrepInputSchema = z.object({
    pattern: z.string().min(1).describe('Regular expression pattern to search for'),
    path: z.string().optional().describe('Directory or file to search in (default: project root)'),
    glob: z.string().optional().describe('Glob pattern to filter files (e.g. "*.ts")'),
    output_mode: z.enum(['content', 'files_with_matches', 'count']).optional().default('content'),
    head_limit: z.number().int().min(1).optional().default(250).describe('Max results for content mode'),
    multiline: z.boolean().optional().default(false),
    case_insensitive: z.boolean().optional().default(false),
});
const IGNORE_PATTERNS = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.next/**', '**/build/**', '**/__pycache__/**'];
const TEXT_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.md', '.mdx', '.txt', '.json', '.yaml', '.yml', '.toml',
    '.html', '.css', '.scss', '.less',
    '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.hpp',
    '.sh', '.bash', '.ps1',
    '.svg', '.xml', '.csv',
]);
export const GrepTool = buildTool({
    name: 'Grep',
    description: 'Search for text patterns in project files using regex. Can be batched with other Read/Grep/Glob calls in one response.',
    searchHint: 'search find text regex grep',
    inputSchema: GrepInputSchema,
    maxResultSizeChars: 20_000,
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
            '## Grep Tool',
            '',
            'Search for patterns in project files.',
            '',
            '- `pattern`: Regular expression to search for',
            '- `path` (optional): Directory/file to search (default: project root)',
            '- `glob` (optional): File pattern filter (e.g. "*.ts")',
            '- `output_mode`: "content" (matches with context), "files_with_matches", or "count"',
            '- `case_insensitive` (optional): Case-insensitive search',
        ].join('\n');
    },
    descriptionFor(input) {
        const p = input.pattern.length > 30 ? input.pattern.slice(0, 30) + '...' : input.pattern;
        return `Search for "${p}" ${input.path ? `in ${input.path}` : ''}`;
    },
    validateInput(input, context) {
        // Validate regex
        try {
            new RegExp(input.pattern, input.multiline ? 'sm' : input.case_insensitive ? 'i' : '');
        }
        catch {
            return { valid: false, message: 'Invalid regular expression pattern.', errorCode: 'INVALID_REGEX' };
        }
        if (input.path) {
            let searchPath = resolve(context.projectRoot, input.path);
            if (!fileExists(searchPath) && context.aicoreDir && !input.path.startsWith('..')) {
                const relPath = input.path.replace(/^.codesquad[\\/]/, '');
                const aicorePath = resolve(context.aicoreDir, relPath);
                if (fileExists(aicorePath))
                    searchPath = aicorePath;
            }
            if (!fileExists(searchPath)) {
                return { valid: false, message: `Path not found: ${input.path}`, errorCode: 'ENOENT' };
            }
            // Block searches in AICore-built-in .codesquad subdirectories (not project/user level)
            if (context.aicoreDir && isProtectedAicorePath(searchPath, context.aicoreDir, context.projectRoot)) {
                return { valid: false, message: 'Searching in this directory is not permitted.', errorCode: 'PROTECTED_PATH' };
            }
        }
        return { valid: true };
    },
    checkPermissions(_input, _context) {
        return { behavior: 'allow' };
    },
    async call(input, context) {
        let searchRoot = input.path ? resolve(context.projectRoot, input.path) : context.projectRoot;
        if (!fileExists(searchRoot) && input.path && context.aicoreDir && !input.path.startsWith('..')) {
            const relPath = input.path.replace(/^.codesquad[\\/]/, '');
            searchRoot = resolve(context.aicoreDir, relPath);
        }
        // Collect files to search
        const globPatterns = [];
        if (fileExists(searchRoot) && statSync(searchRoot).isDirectory()) {
            globPatterns.push(`${searchRoot}/**/*`);
        }
        else {
            globPatterns.push(searchRoot);
        }
        const allFiles = await fastGlob(globPatterns, {
            ignore: IGNORE_PATTERNS,
            absolute: true,
            onlyFiles: true,
            dot: false,
        });
        // Filter by glob
        let files = allFiles;
        if (input.glob) {
            const globFilter = await fastGlob(`**/${input.glob}`, {
                cwd: searchRoot,
                absolute: true,
                onlyFiles: true,
            });
            const globSet = new Set(globFilter);
            files = files.filter((f) => globSet.has(f));
        }
        // Filter to text files
        files = files.filter((f) => {
            const ext = f.split('.').pop()?.toLowerCase();
            if (!ext)
                return false;
            if (TEXT_EXTENSIONS.has(`.${ext}`))
                return true;
            // Heuristic: small files without known extension are likely text
            try {
                if (statSync(f).size < 10_000)
                    return true;
            }
            catch {
                return false;
            }
            return false;
        });
        // Build regex
        const flags = 'g' + (input.multiline ? 'm' : '') + (input.case_insensitive ? 'i' : '');
        const regex = new RegExp(input.pattern, flags);
        // Search
        if (input.output_mode === 'count') {
            let totalMatches = 0;
            const perFile = [];
            for (const file of files) {
                try {
                    const content = readFileSync(file, 'utf-8');
                    const matches = content.match(regex);
                    if (matches) {
                        perFile.push(`${relative(context.projectRoot, file)}: ${matches.length}`);
                        totalMatches += matches.length;
                    }
                    // Write to DiskCache (fire-and-forget)
                    const mtime = statSync(file).mtimeMs;
                    writeDiskCacheAsync(file, content, mtime);
                }
                catch { /* skip unreadable */ }
            }
            return {
                toolCallId: '',
                output: { matches: perFile, matchCount: totalMatches },
                content: perFile.length > 0
                    ? `${totalMatches} matches across ${perFile.length} files:\n${perFile.join('\n')}`
                    : 'No matches found.',
            };
        }
        if (input.output_mode === 'files_with_matches') {
            const matchedFiles = [];
            for (const file of files) {
                try {
                    const content = readFileSync(file, 'utf-8');
                    if (regex.test(content)) {
                        matchedFiles.push(relative(context.projectRoot, file));
                    }
                    regex.lastIndex = 0; // Reset regex state
                    // Write to DiskCache (fire-and-forget)
                    const mtime = statSync(file).mtimeMs;
                    writeDiskCacheAsync(file, content, mtime);
                }
                catch { /* skip */ }
            }
            return {
                toolCallId: '',
                output: { matches: matchedFiles, matchCount: matchedFiles.length },
                content: matchedFiles.length > 0
                    ? matchedFiles.join('\n')
                    : 'No files with matches.',
            };
        }
        // Content mode
        const results = [];
        let totalMatches = 0;
        for (const file of files) {
            if (results.length >= input.head_limit)
                break;
            try {
                const content = readFileSync(file, 'utf-8');
                const lines = content.split('\n');
                const relPath = relative(context.projectRoot, file);
                for (let i = 0; i < lines.length; i++) {
                    if (results.length >= input.head_limit)
                        break;
                    const line = lines[i];
                    if (regex.test(line)) {
                        results.push(`${relPath}:${i + 1}: ${line.trim().slice(0, 200)}`);
                        totalMatches++;
                    }
                }
                // Write to DiskCache (fire-and-forget)
                const mtime = statSync(file).mtimeMs;
                writeDiskCacheAsync(file, content, mtime, lines);
            }
            catch { /* skip */ }
        }
        const suffix = totalMatches > input.head_limit
            ? `\n\n... (${totalMatches - input.head_limit} more matches truncated)`
            : '';
        return {
            toolCallId: '',
            output: { matches: results, matchCount: totalMatches },
            content: results.length > 0
                ? results.join('\n') + suffix
                : 'No matches found.',
        };
    },
});
// ════════════════════════════════════════════════════════════════
// GlobTool
// ════════════════════════════════════════════════════════════════
export const GlobInputSchema = z.object({
    pattern: z.string().min(1).describe('Glob pattern (e.g. "**/*.ts" or "src/**/*.test.ts")'),
    path: z.string().optional().describe('Base directory (default: project root)'),
});
const MAX_GLOB_RESULTS = 100;
export const GlobTool = buildTool({
    name: 'Glob',
    description: 'Find files matching a glob pattern. Can be batched with other Read/Grep/Glob calls in one response.',
    searchHint: 'find files glob pattern search',
    inputSchema: GlobInputSchema,
    maxResultSizeChars: 10_000,
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
            '## Glob Tool',
            '',
            'Find files matching a glob pattern.',
            '',
            '- `pattern` (required): Glob pattern, e.g. "**/*.ts"',
            '- `path` (optional): Base directory (default: project root)',
            '',
            'Results are limited to 100 files. Use more specific patterns if truncated.',
        ].join('\n');
    },
    descriptionFor(input) {
        return `Find "${input.pattern}" ${input.path ? `in ${input.path}` : ''}`;
    },
    validateInput(input, context) {
        if (input.path) {
            let base = resolve(context.projectRoot, input.path);
            if (!fileExists(base) && context.aicoreDir && !input.path.startsWith('..')) {
                const relPath = input.path.replace(/^.codesquad[\\/]/, '');
                const aicorePath = resolve(context.aicoreDir, relPath);
                if (fileExists(aicorePath))
                    base = aicorePath;
            }
            if (!fileExists(base)) {
                return { valid: false, message: `Path not found: ${input.path}`, errorCode: 'ENOENT' };
            }
            // Block glob in AICore-built-in .codesquad subdirectories (not project/user level)
            if (context.aicoreDir && isProtectedAicorePath(base, context.aicoreDir, context.projectRoot)) {
                return { valid: false, message: 'Listing files in this directory is not permitted.', errorCode: 'PROTECTED_PATH' };
            }
        }
        return { valid: true };
    },
    checkPermissions() {
        return { behavior: 'allow' };
    },
    async call(input, context) {
        let cwd = input.path ? resolve(context.projectRoot, input.path) : context.projectRoot;
        if (!fileExists(cwd) && input.path && context.aicoreDir && !input.path.startsWith('..')) {
            const relPath = input.path.replace(/^.codesquad[\\/]/, '');
            cwd = resolve(context.aicoreDir, relPath);
        }
        const results = await fastGlob(input.pattern, {
            cwd,
            ignore: IGNORE_PATTERNS,
            onlyFiles: true,
            absolute: false,
            dot: false,
        });
        const relativeResults = results.map((f) => input.path ? `${input.path}/${f}` : f);
        const truncated = relativeResults.length > MAX_GLOB_RESULTS;
        const shown = relativeResults.slice(0, MAX_GLOB_RESULTS);
        return {
            toolCallId: '',
            output: { files: shown, truncated },
            content: shown.length > 0
                ? shown.join('\n') + (truncated ? `\n\n... (${relativeResults.length - MAX_GLOB_RESULTS} more files)` : '')
                : 'No files found matching the pattern.',
        };
    },
});
//# sourceMappingURL=GrepGlobTool.js.map