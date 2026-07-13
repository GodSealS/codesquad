/**
 * YAML frontmatter parser for Skill SKILL.md files.
 *
 * Parses the frontmatter block (--- ... ---) at the top of a SKILL.md
 * file into a typed object. Used by the skill registry and by the CLI
 * REPL's handleSkillCommand to enforce tool permissions, model overrides,
 * and agent routing — matching Claude Code's Command type capabilities.
 *
 * Two skill types:
 *   - workflow: Standalone multi-step guided workflow (e.g., /start, /setup-engine)
 *   - capability: Extends a specific agent's abilities (e.g., ue-gas → unreal-specialist)
 *
 * Multi-file skills: sub-files in the skill directory auto-loaded based on context
 *   (e.g., cocos_editor/workflow-character.md loaded when user says "character")
 */
import { readdirSync } from 'fs';
import { join } from 'path';
const DEFAULTS = {
    name: '',
    description: '',
    descriptionCn: '',
    argumentHint: '',
    userInvocable: true,
    allowedTools: [],
    type: 'workflow',
    bindTo: [],
    agent: undefined,
    model: undefined,
    thinkingLevel: undefined,
    subFiles: [],
    context: undefined,
};
// ── Parse ──
/**
 * Parse a SKILL.md file's YAML frontmatter and return a typed object.
 *
 * Format:
 * ```
 * ---
 * name: skill-name
 * description: "desc"
 * type: workflow              # workflow (default) or capability
 * bind-to: agent1, agent2     # for capability skills only
 * argument-hint: "[args]"
 * user-invocable: true
 * allowed-tools: Read, Glob, Grep
 * agent: some-agent
 * model: gpt-4
 * ---
 *
 * # Skill body starts here...
 * ```
 *
 * Multi-file skill convention:
 * - Sub-files live alongside SKILL.md (e.g., workflow-character.md)
 * - The main SKILL.md body defines a "Workflow Routing" table with trigger keywords
 * - Sub-files are auto-discovered and their triggers parsed from the routing table
 *
 * @param raw - Full SKILL.md content
 * @param dirPath - Optional directory path for auto-discovering sub-files
 */
export function parseSkillFrontmatter(raw, dirPath) {
    const parts = extractFrontmatter(raw);
    if (!parts) {
        return { ...DEFAULTS, body: raw };
    }
    const fm = parseYamlFlavor(parts.frontmatter);
    const body = raw.slice(parts.endIndex).trim();
    const maxTokensRaw = fm['max-tokens'];
    const maxTokens = maxTokensRaw ? parseInt(maxTokensRaw, 10) : undefined;
    // Derive type: capability if user-invocable is false or type is explicitly set
    const explicitType = fm['type'];
    const userInvocable = parseBool(fm['user-invocable'], DEFAULTS.userInvocable);
    const type = explicitType === 'capability' || explicitType === 'workflow'
        ? explicitType
        : (!userInvocable ? 'capability' : 'workflow');
    // Parse bind-to: agent names that this capability skill extends
    const bindTo = parseStringList(fm['bind-to']);
    // Auto-discover sub-files from the skill directory
    const subFiles = dirPath ? discoverSubFiles(dirPath, body) : [];
    return {
        name: fm['name'] ?? DEFAULTS.name,
        description: fm['description'] ?? DEFAULTS.description,
        descriptionCn: fm['description_cn'] ?? fm['description-cn'] ?? DEFAULTS.descriptionCn,
        argumentHint: fm['argument-hint'] ?? DEFAULTS.argumentHint,
        userInvocable,
        allowedTools: parseStringList(fm['allowed-tools']),
        type,
        bindTo,
        agent: fm['agent'] || undefined,
        model: fm['model'] || undefined,
        maxTokens: Number.isNaN(maxTokens) ? undefined : maxTokens,
        thinkingLevel: ['fast', 'think', 'deep'].includes(fm['thinking-level']) ? fm['thinking-level'] : undefined,
        subFiles,
        context: fm['context'] || undefined,
        body,
    };
}
/**
 * Discover sub-files in a skill directory and extract their trigger keywords
 * from the parent SKILL.md's Workflow Routing table.
 *
 * Pattern: markdown table rows like:
 *   | UI, interface, widget | `workflow-ui.md` |
 *   | character, player, NPC | `workflow-character.md` |
 */
function discoverSubFiles(dirPath, parentBody) {
    const results = [];
    try {
        const entries = readdirSync(dirPath, { withFileTypes: true });
        const subMdFiles = entries.filter((e) => e.isFile() &&
            e.name.endsWith('.md') &&
            e.name !== 'SKILL.md' &&
            e.name !== 'skill.md');
        if (subMdFiles.length === 0)
            return results;
        // Parse routing table from parent body to get trigger keywords
        const routingMap = parseRoutingTable(parentBody);
        for (const file of subMdFiles) {
            const fileName = file.name;
            const name = fileName.replace(/\.md$/, '');
            // Try to find triggers from the routing table, fall back to filename as trigger
            const triggers = routingMap.get(fileName) ?? routingMap.get(name) ?? [name];
            results.push({
                name,
                path: join(dirPath, fileName),
                triggers,
            });
        }
    }
    catch {
        // Directory may not be readable — skip sub-file discovery
    }
    return results;
}
/**
 * Parse a "Workflow Routing" markdown table to extract filename → trigger keywords mapping.
 *
 * Table format:
 *   | Trigger Keywords | Load This File |
 *   |------------------|---------------|
 *   | UI, interface, widget | `workflow-ui.md` |
 *   | character, player, NPC | `workflow-character.md` |
 */
function parseRoutingTable(body) {
    const map = new Map();
    // Find the routing table section
    const tableMatch = body.match(/\|[\s\S]*?Trigger[\s\S]*?\|\s*-[\s\S]*?(\|[\s\S]*?\|\s*[\s\S]*?\|\s*\n)+/i);
    if (!tableMatch)
        return map;
    const rows = tableMatch[0].split('\n');
    for (const row of rows) {
        // Skip header and separator rows
        if (row.includes('---') || row.includes('Trigger') || row.includes('Load This'))
            continue;
        const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
        if (cells.length < 2)
            continue;
        const keywordsCell = cells[0];
        const fileCell = cells[1];
        // Extract filename from backtick formatting: `workflow-ui.md` → workflow-ui.md
        const fileMatch = fileCell.match(/`([^`]+)`/);
        const fileName = fileMatch ? fileMatch[1] : fileCell;
        // Extract comma-separated trigger keywords
        const triggers = keywordsCell
            .split(',')
            .map((k) => k.trim().toLowerCase())
            .filter(Boolean);
        if (triggers.length > 0) {
            map.set(fileName, triggers);
        }
    }
    return map;
}
/**
 * Extract the frontmatter block (between the first two --- lines).
 * Returns the raw frontmatter string and the end index in the original content.
 */
function extractFrontmatter(raw) {
    if (!raw.startsWith('---'))
        return null;
    const end = raw.indexOf('---', 3);
    if (end === -1)
        return null;
    return {
        frontmatter: raw.slice(3, end).trim(),
        endIndex: end + 3,
    };
}
/**
 * Lightweight YAML-flavor parser: handles key: value pairs.
 * Strips inline comments, handles quoted strings, handles comma-separated lists.
 */
function parseYamlFlavor(text) {
    const result = {};
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            continue;
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx === -1)
            continue;
        const key = trimmed.slice(0, colonIdx).trim();
        let value = trimmed.slice(colonIdx + 1).trim();
        // Strip trailing comments (naive: only after quoted value)
        if (value.startsWith('"')) {
            const endQuote = value.indexOf('"', 1);
            if (endQuote !== -1) {
                value = value.slice(1, endQuote);
            }
        }
        else {
            // Strip inline comment
            const commentIdx = value.indexOf(' #');
            if (commentIdx !== -1)
                value = value.slice(0, commentIdx).trim();
            // Handle bare string with trailing comma
            if (value.endsWith(','))
                value = value.slice(0, -1);
        }
        result[key] = value;
    }
    return result;
}
function parseBool(value, fallback) {
    if (value === undefined)
        return fallback;
    const s = value.toLowerCase().trim();
    if (s === 'true' || s === 'yes')
        return true;
    if (s === 'false' || s === 'no')
        return false;
    return fallback;
}
function parseStringList(value) {
    if (!value)
        return [];
    return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}
//# sourceMappingURL=skill-frontmatter.js.map