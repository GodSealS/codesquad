/**
 * FileEditTool — find-and-replace editing with exact string matching.
 *
 * Uses old_string/new_string replace model (NOT line numbers).
 * Multiple matches require replace_all flag or more context.
 *
 * References:
 *   Claude Code src/tools/FileEditTool/FileEditTool.ts (625 lines)
 *
 * Phase 1.5
 */
import { join, resolve, dirname } from 'path';
import { writeFile, mkdir, rename, realpathSync } from 'fs';
import { promisify } from 'util';
import { z } from 'zod';
import { buildTool } from './types.js';
import { wasFileRead, checkFileStaleness, getSessionCache, recordFileRead } from './file-state.js';
import { getRulesForFileOperation } from '../rules/loader.js';
import { fileExists, fileRead } from '../embedded/virtual-fs.js';
const writeFileAsync = promisify(writeFile);
const mkdirAsync = promisify(mkdir);
const renameAsync = promisify(rename);
// ── Schema ──
export const FileEditInputSchema = z.object({
    file_path: z.string().min(1).describe('Path to the file to edit (relative to project root)'),
    old_string: z.string().min(1).describe('Exact text to find and replace'),
    new_string: z.string().describe('Replacement text'),
    replace_all: z.boolean().optional().default(false).describe('Replace all occurrences (default: replace first only)'),
});
// ── Constants ──
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024 * 1024; // 1 GiB (OOM protection)
const DENIED_PREFIXES = ['.env', '.git/', 'node_modules/'];
// ── Tool ──
export const FileEditTool = buildTool({
    name: 'Edit',
    description: 'Edit a file by replacing exact text. Use the Read tool first to see line numbers and content. Can be batched with edits/writes to DIFFERENT files in one response.',
    searchHint: 'edit file modify replace',
    inputSchema: FileEditInputSchema,
    maxResultSizeChars: 10_000,
    isReadOnly() {
        return false;
    },
    isConcurrencySafe() {
        return true;
    },
    isDestructive() {
        return true;
    },
    prompt() {
        return [
            '## File Edit Tool',
            '',
            'Edit files by finding and replacing exact text.',
            'Uses old_string → new_string model (NOT line numbers).',
            '',
            '- `file_path` (required): File to edit, relative to project root',
            '- `old_string` (required): Exact text to replace',
            '- `new_string` (required): Replacement text',
            '- `replace_all` (optional): Replace all occurrences (default: false)',
            '',
            '**CRITICAL**: `old_string` must be an exact substring of the file.',
            'If your match fails, provide more surrounding context to make it unique.',
            'Always read the file first with the Read tool to see exact content.',
            '',
            'If `old_string` matches multiple locations, you must either:',
            '1. Set `replace_all=true` to replace all matches, or',
            '2. Provide more context in `old_string` to make it unique.',
        ].join('\n');
    },
    descriptionFor(input) {
        return `Edit \`${input.file_path}\`: ${summarizeEdit(input.old_string, input.new_string)}`;
    },
    validateInput(input, context) {
        const filePath = resolve(context.projectRoot, input.file_path);
        // Check denied prefixes
        for (const prefix of DENIED_PREFIXES) {
            if (input.file_path.startsWith(prefix) || filePath.includes(prefix)) {
                return {
                    valid: false,
                    message: `Cannot edit "${prefix}" paths.`,
                    errorCode: 'PATH_DENIED',
                };
            }
        }
        // Check existence
        if (!fileExists(filePath)) {
            return {
                valid: false,
                message: `File not found: ${input.file_path}`,
                errorCode: 'ENOENT',
            };
        }
        // Resolve symlinks to prevent path traversal
        try {
            const realPath = realpathSync(filePath);
            if (!realPath.startsWith(context.projectRoot)) {
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
        // Check size (OOM protection)
        const content = fileRead(filePath);
        if (content.length > MAX_FILE_SIZE_BYTES) {
            return {
                valid: false,
                message: 'File too large (> 1 GiB).',
                errorCode: 'FILE_TOO_LARGE',
            };
        }
        // Check that old_string exists in file
        if (!input.old_string.trim()) {
            return {
                valid: false,
                message: 'old_string cannot be empty.',
                errorCode: 'EMPTY_OLD_STRING',
            };
        }
        return { valid: true };
    },
    checkPermissions(input, context) {
        if (context.permissionMode === 'plan' ||
            context.permissionMode === 'bypassPermissions' ||
            context.permissionMode === 'acceptEdits') {
            return { behavior: 'allow' };
        }
        const filePath = resolve(context.projectRoot, input.file_path);
        // Enforce Read-then-Write
        if (!wasFileRead(getSessionCache(), filePath)) {
            return {
                behavior: 'deny',
                message: `File "${input.file_path}" has not been read yet. Use the Read tool first.`,
            };
        }
        // Check staleness
        const currentContent = fileRead(filePath);
        const stale = checkFileStaleness(getSessionCache(), filePath, currentContent);
        if (stale.stale) {
            return {
                behavior: 'deny',
                message: 'File has been modified since read. Read again before editing.',
            };
        }
        return { behavior: 'ask', message: `Edit ${input.file_path}?` };
    },
    async call(input, context) {
        const filePath = resolve(context.projectRoot, input.file_path);
        const original = fileRead(filePath);
        // Inject path-matched rules into context
        const aicoreRulesDir = context.aicoreDir
            ? join(context.aicoreDir, 'rules')
            : join(context.projectRoot, '.codesquad', 'rules');
        const rulesCtx = getRulesForFileOperation(input.file_path, aicoreRulesDir);
        if (rulesCtx) {
            context.session.context.injectedContent =
                (context.session.context.injectedContent || '') + '\n' + rulesCtx;
        }
        // Count matches
        const matchCount = countOccurrences(original, input.old_string);
        if (matchCount === 0) {
            return {
                toolCallId: '',
                output: { filePath: input.file_path, replacements: 0, diff: '' },
                content: `[Error] Could not find "${truncate(input.old_string, 60)}" in ${input.file_path}. Make sure old_string is an exact substring.`,
            };
        }
        if (matchCount > 1 && !input.replace_all) {
            return {
                toolCallId: '',
                output: { filePath: input.file_path, replacements: 0, diff: '' },
                content: `[Error] Found ${matchCount} matches for "${truncate(input.old_string, 60)}". Set replace_all=true or provide more context to make the match unique.`,
            };
        }
        // Replace
        const modified = input.replace_all
            ? original.replaceAll(input.old_string, input.new_string)
            : original.replace(input.old_string, input.new_string);
        if (modified === original) {
            return {
                toolCallId: '',
                output: { filePath: input.file_path, replacements: 0, diff: '' },
                content: '[Info] No changes were made (old_string equals new_string).',
            };
        }
        // Atomic write
        const tmpPath = `${filePath}.tmp.${Date.now()}`;
        await mkdirAsync(dirname(filePath), { recursive: true });
        await writeFileAsync(tmpPath, modified, 'utf-8');
        await renameAsync(tmpPath, filePath);
        // Update read cache with new content
        recordFileRead(getSessionCache(), filePath, modified);
        // Generate diff
        const diff = generateDiff(input.old_string, input.new_string, matchCount);
        const replacements = input.replace_all ? matchCount : 1;
        return {
            toolCallId: '',
            output: { filePath: input.file_path, replacements, diff },
            content: `Edited \`${input.file_path}\` (${replacements} replacement${replacements > 1 ? 's' : ''}):\n\n${diff}`,
        };
    },
});
// ── Helpers ──
function countOccurrences(str, substring) {
    let count = 0;
    let pos = 0;
    while ((pos = str.indexOf(substring, pos)) !== -1) {
        count++;
        pos += substring.length;
    }
    return count;
}
function generateDiff(oldStr, newStr, count) {
    const o = truncate(oldStr, 80);
    const n = truncate(newStr, 80);
    return [
        '```diff',
        `- ${o}`,
        `+ ${n}`,
        count > 1 ? `(×${count} occurrences)` : '',
        '```',
    ].filter(Boolean).join('\n');
}
function truncate(s, maxLen) {
    return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}
function summarizeEdit(oldStr, newStr) {
    const o = oldStr.split('\n')[0]?.slice(0, 40) || '';
    const n = newStr.split('\n')[0]?.slice(0, 40) || '';
    if (!o && !n)
        return 'empty replacement';
    if (!o)
        return `insert "${n}..."`;
    if (!n)
        return `delete "${o}..."`;
    return `"${o}..." → "${n}..."`;
}
//# sourceMappingURL=FileEditTool.js.map