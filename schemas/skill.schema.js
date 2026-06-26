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
        argumentHint: frontmatter['argument-hint'],
        userInvocable: frontmatter['user-invocable'],
        allowedTools: frontmatter['allowed-tools'],
        model: frontmatter.model,
        context: frontmatter.context,
        body: (rawBody ?? '').trimEnd(),
        extra: {},
    };
    // Capture any unrecognized frontmatter keys
    const knownKeys = new Set([
        'name', 'description', 'argument-hint', 'user-invocable',
        'allowed-tools', 'model', 'context',
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
//# sourceMappingURL=skill.schema.js.map