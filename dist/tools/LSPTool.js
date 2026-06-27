/**
 * LSPTool — check a file for language server diagnostics (errors/warnings).
 *
 * After an Edit or Write, the agent can call this tool to verify
 * the file compiles cleanly before proceeding. Focused on TypeScript
 * via tsserver (typescript-language-server).
 *
 * References:
 *   Claude Code src/tools/LSPTool/LSPTool.ts (26KB)
 *
 * Phase 6 — P5 Vibe Coding
 */
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildTool } from './types.js';
import { startLspClient, changeFile, getDiagnostics, } from '../services/lsp-client.js';
// ── Input Schema ──
const InputSchema = z.object({
    file_path: z.string().describe('Absolute or relative path to the file to check'),
    /** If true, wait for publishDiagnostics before returning (up to 3s). */
    waitForFresh: z.boolean().optional().default(true).describe('Wait for fresh diagnostics from LSP server'),
});
// ── Helpers ──
function resolvePath(filePath, cwd) {
    return resolve(cwd, filePath);
}
function severityIcon(s) {
    switch (s) {
        case 'error': return '❌';
        case 'warning': return '⚠️';
        case 'info': return 'ℹ️';
        case 'hint': return '💡';
        default: return '·';
    }
}
// ── Tool ──
export const LSPTool = buildTool({
    name: 'LSP',
    description: 'Check a file for TypeScript language server diagnostics (errors, warnings).',
    searchHint: 'lsp diagnostics check errors typescript tsc',
    inputSchema: InputSchema,
    prompt() {
        return `Checks a file for TypeScript/JavaScript language server diagnostics.

Parameters:
- file_path: Path to the file to check (absolute or relative)
- waitForFresh: Wait for LSP server to re-analyze before returning (default true)

Returns: Array of {line, character, message, severity} for each diagnostic found.

Use this tool after editing or writing TypeScript files to verify no errors were introduced.
The LSP server (typescript-language-server) provides live error/warning detection.`;
    },
    descriptionFor(input) {
        return `Check diagnostics: ${input.file_path}`;
    },
    isEnabled(_ctx) {
        return true;
    },
    isReadOnly() { return true; },
    isConcurrencySafe() { return true; },
    isDestructive() { return false; },
    validateInput(input, _ctx) {
        if (!input.file_path.trim()) {
            return { valid: false, message: 'file_path is required' };
        }
        return { valid: true };
    },
    checkPermissions() { return { behavior: 'allow' }; },
    async call(input, context) {
        const toolCallId = randomUUID();
        const absPath = resolvePath(input.file_path, context.cwd);
        // Read file content
        let content;
        try {
            content = readFileSync(absPath, 'utf-8');
        }
        catch {
            return {
                toolCallId,
                output: [],
                content: `❌ Cannot read file: ${absPath}`,
                isError: true,
            };
        }
        // Only support TypeScript/JavaScript files
        const ext = absPath.split('.').pop()?.toLowerCase() || '';
        const supported = ['ts', 'tsx', 'js', 'jsx'];
        if (!supported.includes(ext)) {
            return {
                toolCallId,
                output: [],
                content: `ℹ️ LSP currently only supports TypeScript/JavaScript files (.ts/.tsx/.js/.jsx).\n` +
                    `File: ${absPath} (ext: .${ext})\n` +
                    `To check non-TS files, use BashTool with appropriate compiler/linter.`,
            };
        }
        try {
            // Ensure LSP client is running
            await startLspClient(context.projectRoot);
            // Tell LSP server about the file change
            await changeFile(absPath, content);
            // Wait for diagnostics
            if (input.waitForFresh) {
                // Give LSP server time to process
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
            const diagnostics = await getDiagnostics(absPath);
            if (diagnostics.length === 0) {
                return {
                    toolCallId,
                    output: [],
                    content: `✅ No diagnostics found for: ${absPath}`,
                };
            }
            // Format results
            const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
            const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;
            const lines = [
                `🔍 LSP diagnostics for: ${absPath}`,
                `   ${errorCount} error(s), ${warningCount} warning(s), ${diagnostics.length} total`,
                '',
                ...diagnostics.map((d) => `  L${String(d.line).padStart(4)}:${String(d.character).padStart(3)} ${severityIcon(d.severity)} ${d.message}${d.code ? ` (${d.code})` : ''}`),
            ];
            const resultDiagnostics = diagnostics.map((d) => ({
                line: d.line,
                character: d.character,
                message: d.message,
                severity: d.severity,
            }));
            return {
                toolCallId,
                output: resultDiagnostics,
                content: lines.join('\n'),
                isError: errorCount > 0, // Mark as error if there are actual errors
            };
        }
        catch (err) {
            return {
                toolCallId,
                output: [],
                content: `❌ LSP check failed: ${err.message}\n\n` +
                    `To enable LSP diagnostics, install typescript-language-server:\n` +
                    `  npm install -g typescript-language-server typescript\n` +
                    `Or check the file with: npx tsc --noEmit`,
                isError: true,
            };
        }
    },
    maxResultSizeChars: 10000,
});
//# sourceMappingURL=LSPTool.js.map