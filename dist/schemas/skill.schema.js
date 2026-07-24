/**
 * Skill MD Parser
 *
 * Parses YAML frontmatter + body from skill markdown files.
 * Format: skills/<name>/SKILL.md
 */
import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
/** Regex to match YAML frontmatter between --- delimiters */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
/**
 * Parse a raw skill markdown string into a SkillDef.
 */
export function parseSkillMd(content, sourcePath) {
    const match = content.match(FRONTMATTER_RE);
    if (!match) {
        throw new Error(`Invalid skill markdown: no frontmatter found${sourcePath ? ` in ${sourcePath}` : ''}`);
    }
    const [, rawFrontmatter, rawBody] = match;
    const frontmatter = parseYaml(rawFrontmatter ?? '');
    // Validate required fields
    if (!frontmatter.name || typeof frontmatter.name !== 'string') {
        throw new Error(`Skill missing required 'name' field${sourcePath ? ` in ${sourcePath}` : ''}`);
    }
    if (!frontmatter.description || typeof frontmatter.description !== 'string') {
        throw new Error(`Skill '${frontmatter.name}' missing required 'description' field${sourcePath ? ` in ${sourcePath}` : ''}`);
    }
    const skill = {
        name: frontmatter.name,
        description: frontmatter.description,
        descriptionCn: frontmatter.description_cn,
        argumentHint: frontmatter['argument-hint'],
        userInvocable: frontmatter['user-invocable'],
        allowedTools: frontmatter['allowed-tools'],
        type: frontmatter.type,
        bindTo: parseBindTo(frontmatter['bind-to']),
        agent: frontmatter.agent,
        model: frontmatter.model,
        maxTokens: parseOptionalInt(frontmatter['max-tokens']),
        thinkingLevel: ['fast', 'think', 'deep'].includes(frontmatter['thinking-level'])
            ? frontmatter['thinking-level']
            : undefined,
        context: frontmatter.context,
        body: (rawBody ?? '').trimEnd(),
        extra: {},
    };
    // Capture any unrecognized frontmatter keys
    const knownKeys = new Set([
        'name', 'description', 'description_cn',
        'argument-hint', 'user-invocable', 'allowed-tools',
        'type', 'bind-to', 'agent', 'model', 'max-tokens',
        'thinking-level', 'context',
    ]);
    for (const key of Object.keys(frontmatter)) {
        if (!knownKeys.has(key)) {
            skill.extra[key] = frontmatter[key];
        }
    }
    return skill;
}
/**
 * Read and parse a skill markdown file from disk.
 */
export function readSkillMd(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    return parseSkillMd(content, filePath);
}
/** Parse comma-separated bind-to list. */
function parseBindTo(value) {
    if (typeof value !== 'string')
        return undefined;
    return value.split(',').map((s) => s.trim()).filter(Boolean);
}
/** Parse optional integer, returns undefined on failure. */
function parseOptionalInt(value) {
    if (typeof value === 'number')
        return value;
    if (typeof value === 'string') {
        const n = parseInt(value, 10);
        return Number.isNaN(n) ? undefined : n;
    }
    return undefined;
}
//# sourceMappingURL=skill.schema.js.map