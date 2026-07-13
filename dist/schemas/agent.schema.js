/**
 * Agent MD Parser
 *
 * Parses YAML frontmatter + body from agent markdown files.
 * Format: agents/<name>.md
 */
import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
/** Regex to match YAML frontmatter between --- delimiters */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
/**
 * Parse a raw agent markdown string into an AgentDef.
 */
export function parseAgentMd(content, sourcePath) {
    const match = content.match(FRONTMATTER_RE);
    if (!match) {
        throw new Error(`Invalid agent markdown: no frontmatter found${sourcePath ? ` in ${sourcePath}` : ''}`);
    }
    const [, rawFrontmatter, rawBody] = match;
    const frontmatter = parseYaml(rawFrontmatter ?? '');
    // Validate required fields
    if (!frontmatter.name || typeof frontmatter.name !== 'string') {
        throw new Error(`Agent missing required 'name' field${sourcePath ? ` in ${sourcePath}` : ''}`);
    }
    if (!frontmatter.description || typeof frontmatter.description !== 'string') {
        throw new Error(`Agent '${frontmatter.name}' missing required 'description' field${sourcePath ? ` in ${sourcePath}` : ''}`);
    }
    const agent = {
        name: frontmatter.name,
        description: frontmatter.description,
        tools: frontmatter.tools ?? 'Read',
        model: frontmatter.model ?? 'unknown',
        maxTurns: frontmatter.maxTurns,
        disallowedTools: frontmatter.disallowedTools,
        skills: frontmatter.skills,
        memory: frontmatter.memory,
        agentMode: frontmatter.agentMode,
        enabled: frontmatter.enabled,
        enabledAutoRun: frontmatter.enabledAutoRun,
        thinkingLevel: frontmatter.thinkingLevel ?? 'deep',
        body: (rawBody ?? '').trimEnd(),
        extra: {},
    };
    // Capture any unrecognized frontmatter keys
    const knownKeys = new Set([
        'name', 'description', 'tools', 'model', 'maxTurns',
        'disallowedTools', 'skills', 'memory', 'agentMode',
        'enabled', 'enabledAutoRun', 'thinkingLevel',
    ]);
    for (const key of Object.keys(frontmatter)) {
        if (!knownKeys.has(key)) {
            agent.extra[key] = frontmatter[key];
        }
    }
    return agent;
}
/**
 * Read and parse an agent markdown file from disk.
 */
export function readAgentMd(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    return parseAgentMd(content, filePath);
}
//# sourceMappingURL=agent.schema.js.map