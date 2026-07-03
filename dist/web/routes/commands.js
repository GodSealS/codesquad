/**
 * Commands API — list, detail, search.
 * Scans three layers: Project (.codesquad/) > User (~/.codesquad/) > .codesquad/
 *
 * .codesquad layer uses VirtualFS so it works both from embedded binary and disk.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getCodeSquadUserCategory } from '../../core/paths.js';
import { virtualExists, virtualReadFile, virtualReadDir, AICORE_ROOT } from '../../embedded/virtual-fs.js';
// Use canonical path from virtual-fs.ts (handles Bun-compiled correctly)
const AICORE_DIR = AICORE_ROOT;
/** Get project-level .codesquad directory. */
function getProjectCodeSquadDir() {
    return join(process.cwd(), '.codesquad');
}
/** Scan a directory for commands, return map keyed by name. VirtualFS handles both embedded and disk. */
function scanCommandDir(dir, layer) {
    const map = new Map();
    const entries = virtualReadDir(dir);
    for (const f of entries) {
        if (!f.endsWith('.md'))
            continue;
        const commandName = f.replace('.md', '');
        const fullPath = join(dir, f);
        try {
            const content = virtualReadFile(fullPath, 'utf-8');
            const sizeBytes = Buffer.byteLength(content, 'utf-8');
            const name = extractFrontmatterField(content, 'name') || commandName;
            const description = extractFrontmatterField(content, 'description') || extractDescription(content);
            const description_cn = extractFrontmatterField(content, 'description_cn') || description;
            const userInvocable = extractFrontmatterField(content, 'user-invocable') !== 'false';
            const skill = extractFrontmatterField(content, 'skill');
            const argumentHint = extractFrontmatterField(content, 'argument-hint');
            const category = extractFrontmatterField(content, 'category'); // Bug 3: extract category
            map.set(commandName, {
                id: commandName,
                name,
                description,
                description_cn,
                sizeBytes,
                layer,
                userInvocable,
                category,
                skill,
                argumentHint,
            });
        }
        catch {
            // Silently skip corrupted files
            continue;
        }
    }
    return map;
}
/** Merge layered maps: later layers override earlier ones. */
function mergeMaps(base, override) {
    const merged = new Map(base);
    for (const [key, val] of override) {
        merged.set(key, val);
    }
    return merged;
}
/** Extract a short description from a command markdown file. */
function extractDescription(content) {
    const body = content.replace(/^---[\s\S]*?---\n*/m, '').trim();
    const lines = body.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('>') && trimmed.length > 10) {
            return trimmed.slice(0, 120) + (trimmed.length > 120 ? '…' : '');
        }
    }
    return '';
}
/** Extract a frontmatter field value (supports quoted, unquoted, and escaped quotes). */
function extractFrontmatterField(content, field) {
    // Escape regex-special chars in field name (e.g. user-invocable, argument-hint)
    const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match: field: value  OR  field: "value with \"escaped\" quotes"
    const re = new RegExp(`${escapedField}:\\s*"((?:[^"\\\\]|\\\\.)*)"|${escapedField}:\\s*(\\S.*)`, 'im');
    const m = content.match(re);
    if (!m)
        return '';
    // Group 1: quoted value (unescape \" → "), Group 2: unquoted value
    const raw = m[1] !== undefined ? m[1].replace(/\\"/g, '"') : m[2]?.trim();
    return raw || '';
}
export async function handleCommands(req, res, _services, path) {
    const name = path.slice('/api/commands'.length).replace(/^\/+/, '');
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const query = url.searchParams.get('q')?.toLowerCase();
    // GET /api/commands/:name — full document (three-layer fallback: project > user > aicore)
    if (name) {
        // Try project layer first
        let filePath = join(getProjectCodeSquadDir(), 'commands', `${name}.md`);
        let content = null;
        if (existsSync(filePath)) {
            content = readFileSync(filePath, 'utf-8');
        }
        // Try user layer
        if (!content) {
            filePath = join(getCodeSquadUserCategory('commands'), `${name}.md`);
            if (existsSync(filePath)) {
                content = readFileSync(filePath, 'utf-8');
            }
        }
        // Try AICORE layer (bundled)
        if (!content) {
            filePath = join(AICORE_DIR, 'commands', `${name}.md`);
            if (virtualExists(filePath)) {
                content = virtualReadFile(filePath, 'utf-8');
            }
        }
        if (!content) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Command not found' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ name, content }));
        return;
    }
    // GET /api/commands — list (three-layer: project > user-home > aicore)
    try {
        let commandMap = scanCommandDir(join(AICORE_DIR, 'commands'), 'user');
        const homeMap = scanCommandDir(getCodeSquadUserCategory('commands'), 'user');
        commandMap = mergeMaps(commandMap, homeMap);
        const projectMap = scanCommandDir(join(getProjectCodeSquadDir(), 'commands'), 'project');
        commandMap = mergeMaps(commandMap, projectMap);
        let commands = Array.from(commandMap.values());
        if (query) {
            commands = commands.filter((c) => c.name.toLowerCase().includes(query) ||
                c.description.toLowerCase().includes(query) ||
                (c.description_cn && c.description_cn.toLowerCase().includes(query)));
        }
        // Filter out non-user-invocable commands for the UI
        const userCommands = commands.filter(c => c.userInvocable !== false);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            commands: userCommands.sort((a, b) => a.name.localeCompare(b.name)),
            total: userCommands.length
        }));
    }
    catch (error) {
        console.error('Failed to list commands:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to list commands' }));
    }
}
//# sourceMappingURL=commands.js.map