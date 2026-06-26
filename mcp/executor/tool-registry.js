/**
 * Tool Registry — Handler Registry
 *
 * Maps tool names to executable handlers.
 * Each handler receives arguments and workspace path, returns result.
 *
 * Safety:
 *   - All file paths validated against workspace boundary
 *   - Bash requires whitelist
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { globSync } from 'fast-glob';
/** Check if a path is within the allowed workspace boundary */
function resolveSafePath(requestedPath, workspaceRoot) {
    const resolved = resolve(workspaceRoot, requestedPath);
    // Verify the resolved path is within workspace
    if (!resolved.startsWith(resolve(workspaceRoot))) {
        throw new Error(`Path traversal detected: ${requestedPath} resolves outside workspace`);
    }
    return resolved;
}
/** Read file handler */
async function handleRead(args, workspaceRoot) {
    const filePath = resolveSafePath(args.filePath, workspaceRoot);
    if (!existsSync(filePath)) {
        return { success: false, output: '', error: `File not found: ${filePath}` };
    }
    const content = readFileSync(filePath, 'utf-8');
    const offset = typeof args.offset === 'number' ? args.offset : undefined;
    const limit = typeof args.limit === 'number' ? args.limit : undefined;
    if (offset !== undefined || limit !== undefined) {
        const lines = content.split('\n');
        const start = offset ?? 0;
        const end = limit ? start + limit : lines.length;
        return { success: true, output: lines.slice(start, end).join('\n'), filePath };
    }
    return { success: true, output: content, filePath };
}
/** Write file handler */
async function handleWrite(args, workspaceRoot) {
    const filePath = resolveSafePath(args.filePath, workspaceRoot);
    const content = args.content;
    // Ensure parent directory exists
    const parentDir = dirname(filePath);
    if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
    }
    writeFileSync(filePath, content, 'utf-8');
    return { success: true, output: `File written: ${filePath} (${content.length} bytes)`, filePath };
}
/** Edit file handler */
async function handleEdit(args, workspaceRoot) {
    const filePath = resolveSafePath(args.filePath, workspaceRoot);
    if (!existsSync(filePath)) {
        return { success: false, output: '', error: `File not found: ${filePath}` };
    }
    const oldStr = args.old_str;
    const newStr = args.new_str;
    const content = readFileSync(filePath, 'utf-8');
    if (!content.includes(oldStr)) {
        return { success: false, output: '', error: `old_str not found in file: ${filePath}` };
    }
    const updated = content.replace(oldStr, newStr);
    writeFileSync(filePath, updated, 'utf-8');
    return { success: true, output: `File edited: ${filePath}`, filePath };
}
/** Glob handler */
async function handleGlob(args, workspaceRoot) {
    const pattern = args.pattern;
    const searchDir = args.path ? resolveSafePath(args.path, workspaceRoot) : workspaceRoot;
    try {
        const files = globSync(pattern, { cwd: searchDir, dot: false, onlyFiles: true });
        return { success: true, output: JSON.stringify(files) };
    }
    catch (err) {
        return { success: false, output: '', error: String(err) };
    }
}
/** Grep handler — uses basic string matching (no ripgrep dependency) */
async function handleGrep(args, workspaceRoot) {
    const pattern = args.pattern;
    const searchDir = args.path ? resolveSafePath(args.path, workspaceRoot) : workspaceRoot;
    const fileGlob = args.glob ?? '**/*';
    try {
        const regex = new RegExp(pattern, 'gi');
        const files = globSync(fileGlob, { cwd: searchDir, dot: false, onlyFiles: true });
        const results = [];
        for (const file of files.slice(0, 500)) {
            const fullPath = join(searchDir, file);
            try {
                const content = readFileSync(fullPath, 'utf-8');
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (regex.test(lines[i] ?? '')) {
                        results.push(`${file}:${i + 1}: ${(lines[i] ?? '').trim()}`);
                    }
                }
            }
            catch {
                // Skip unreadable files
            }
        }
        return { success: true, output: results.join('\n') || 'No matches found' };
    }
    catch (err) {
        return { success: false, output: '', error: String(err) };
    }
}
/** Web search handler — placeholder */
async function handleWebSearch(args, _workspaceRoot) {
    return {
        success: false,
        output: '',
        error: 'WebSearch not yet implemented. Use a real search API integration.',
    };
}
/** Web fetch handler */
async function handleWebFetch(args, _workspaceRoot) {
    const url = args.url;
    try {
        const response = await fetch(url);
        const text = await response.text();
        return { success: true, output: text.slice(0, 10000) };
    }
    catch (err) {
        return { success: false, output: '', error: String(err) };
    }
}
/** Bash handler — whitelist-only */
async function handleBash(args, workspaceRoot, bashWhitelist) {
    const command = args.command;
    if (!bashWhitelist.some(c => command.startsWith(c))) {
        return {
            success: false,
            output: '',
            error: `Bash command not in whitelist: ${command}. Allowed: ${bashWhitelist.join(', ')}`,
        };
    }
    try {
        const { execSync } = await import('child_process');
        const output = execSync(command, { cwd: workspaceRoot, encoding: 'utf-8', timeout: 30000 });
        return { success: true, output };
    }
    catch (err) {
        return { success: false, output: '', error: String(err) };
    }
}
/** All tool handlers (stateless) — standard 2-arg signature */
const HANDLERS = {
    Read: handleRead,
    Write: handleWrite,
    Edit: handleEdit,
    Glob: handleGlob,
    Grep: handleGrep,
    WebSearch: handleWebSearch,
    WebFetch: handleWebFetch,
};
/** Execute a tool by name */
export async function executeTool(toolName, args, workspaceRoot, bashWhitelist = []) {
    // Bash requires whitelist — handled separately
    if (toolName === 'Bash') {
        return handleBash(args, workspaceRoot, bashWhitelist);
    }
    const handler = HANDLERS[toolName];
    if (!handler) {
        return { success: false, output: '', error: `Unknown tool: ${toolName}` };
    }
    return handler(args, workspaceRoot);
}
//# sourceMappingURL=tool-registry.js.map