/**
 * FileWriteTool — write files with Read-then-Write enforcement.
 *
 * References:
 *   Claude Code src/tools/FileWriteTool/FileWriteTool.ts (435 lines)
 *
 * Phase 1.4
 */
import { writeFile, mkdir, rename, existsSync } from 'fs';
import { promisify } from 'util';
import { dirname, resolve, join } from 'path';
import { z } from 'zod';
import { buildTool } from './types.js';
import { wasFileRead, checkFileStaleness, getSessionCache } from './file-state.js';
import { getRulesForFileOperation } from '../rules/loader.js';
const writeFileAsync = promisify(writeFile);
const mkdirAsync = promisify(mkdir);
const renameAsync = promisify(rename);
// ── Schema ──
export const FileWriteInputSchema = z.object({
    file_path: z.string().min(1).describe('Path to write to (relative to project root)'),
    content: z.string().describe('Content to write'),
});
// ── Constants ──
const MAX_CONTENT_SIZE = 500 * 1024; // 500KB
const DENIED_PREFIXES = ['.env', '.git/', 'node_modules/'];
// ── Tool ──
export const FileWriteTool = buildTool({
    name: 'Write',
    description: 'Write content to a file (create or overwrite). Requires file to be read first unless new.',
    searchHint: 'write file create save',
    inputSchema: FileWriteInputSchema,
    maxResultSizeChars: 5_000,
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
            '## File Write Tool',
            '',
            'Write content to a file in the project.',
            'Uses atomic write (temp file + rename) to prevent corruption.',
            '',
            '- `file_path` (required): Path relative to project root',
            '- `content` (required): Full file content to write',
            '',
            '**IMPORTANT**: You MUST read the file with the Read tool first',
            'before writing to it (unless creating a new file).',
        ].join('\n');
    },
    descriptionFor(input) {
        const isNew = !existsSync(resolve(process.cwd(), input.file_path));
        return `${isNew ? 'Create' : 'Write'} \`${input.file_path}\` (${formatSize(input.content.length)})`;
    },
    validateInput(input, context) {
        const filePath = resolve(context.projectRoot, input.file_path);
        // Check denied prefixes (security)
        for (const prefix of DENIED_PREFIXES) {
            if (input.file_path.startsWith(prefix) || filePath.includes(prefix)) {
                return {
                    valid: false,
                    message: `Cannot write to "${prefix}" paths. Use a different location.`,
                    errorCode: 'PATH_DENIED',
                };
            }
        }
        // Check content size
        if (input.content.length > MAX_CONTENT_SIZE) {
            return {
                valid: false,
                message: `Content too large (${formatSize(input.content.length)}). Max: ${formatSize(MAX_CONTENT_SIZE)}.`,
                errorCode: 'CONTENT_TOO_LARGE',
            };
        }
        // Check path is under project root
        if (!filePath.startsWith(context.projectRoot)) {
            return {
                valid: false,
                message: 'File path must be within the project directory.',
                errorCode: 'PATH_OUTSIDE_PROJECT',
            };
        }
        return { valid: true };
    },
    checkPermissions(input, context) {
        // Plan mode: no writes allowed
        if (context.permissionMode === 'plan') {
            return {
                behavior: 'deny',
                message: 'File writing is not allowed in Plan mode. Switch to Craft mode to write files.',
            };
        }
        const filePath = resolve(context.projectRoot, input.file_path);
        const isNew = !existsSync(filePath);
        // New files: check bypassPermissions or acceptEdits
        if (isNew) {
            if (context.permissionMode === 'bypassPermissions' || context.permissionMode === 'acceptEdits') {
                return { behavior: 'allow' };
            }
            // Default: ask
            return {
                behavior: 'ask',
                message: `Create new file: ${input.file_path}?`,
            };
        }
        // Existing files: enforce Read-then-Write
        if (!wasFileRead(getSessionCache(), filePath)) {
            return {
                behavior: 'deny',
                message: `File "${input.file_path}" has not been read yet. Use the Read tool first before writing.`,
            };
        }
        // Check staleness
        const stale = checkFileStaleness(getSessionCache(), filePath, input.content);
        if (stale.stale && !(context.permissionMode === 'bypassPermissions')) {
            return {
                behavior: 'deny',
                message: `File "${input.file_path}" has been modified since it was last read. Read it again before writing.`,
            };
        }
        // acceptEdits or bypass: auto-allow
        if (context.permissionMode === 'bypassPermissions' || context.permissionMode === 'acceptEdits') {
            return { behavior: 'allow' };
        }
        return { behavior: 'ask', message: `Write to ${input.file_path}?` };
    },
    async call(input, context) {
        const filePath = resolve(context.projectRoot, input.file_path);
        const isNew = !existsSync(filePath);
        // Inject path-matched rules into context
        const aicoreRulesDir = context.aicoreDir
            ? join(context.aicoreDir, 'rules')
            : join(context.projectRoot, 'AICore', 'rules');
        const rulesCtx = getRulesForFileOperation(input.file_path, aicoreRulesDir);
        if (rulesCtx) {
            context.session.context.injectedContent =
                (context.session.context.injectedContent || '') + '\n' + rulesCtx;
        }
        // Atomic write: temp file + rename
        const tmpPath = `${filePath}.tmp.${Date.now()}`;
        // Ensure directory exists
        await mkdirAsync(dirname(filePath), { recursive: true });
        // Write to temp
        await writeFileAsync(tmpPath, input.content, 'utf-8');
        // Atomic rename
        await renameAsync(tmpPath, filePath);
        const bytesWritten = Buffer.byteLength(input.content, 'utf-8');
        return {
            toolCallId: '',
            output: { filePath: input.file_path, bytesWritten, isNew },
            content: `${isNew ? 'Created' : 'Updated'} \`${input.file_path}\` (${formatSize(bytesWritten)})`,
        };
    },
});
function formatSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
//# sourceMappingURL=FileWriteTool.js.map