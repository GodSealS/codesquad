/**
 * Stub Generator
 *
 * Converts full AICore agent/skill definitions to MCP stub format (v2).
 * Reads from AICore/ and writes .aicore-mcp-stubs/ (or in-place).
 */
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync, statSync, copyFileSync } from 'fs';
import { join, dirname, resolve, extname } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { AICORE_AGENTS_DIR, AICORE_SKILLS_DIR, CLI_PACKAGE_ROOT } from './paths.js';
// ── Tag Inference ──
/** Infer tags from agent name + description */
function inferAgentTags(name, description) {
    const tags = [];
    const lower = `${name} ${description}`.toLowerCase();
    if (lower.includes('design'))
        tags.push('design');
    if (lower.includes('program') || lower.includes('engine'))
        tags.push('programming');
    if (lower.includes('art') || lower.includes('visual'))
        tags.push('art');
    if (lower.includes('audio') || lower.includes('sound'))
        tags.push('audio');
    if (lower.includes('ui') || lower.includes('ux'))
        tags.push('ui');
    if (lower.includes('qa') || lower.includes('test'))
        tags.push('qa');
    if (lower.includes('producer') || lower.includes('lead') || lower.includes('director'))
        tags.push('leadership');
    if (lower.includes('level') || lower.includes('world'))
        tags.push('content');
    if (lower.includes('narrative') || lower.includes('writer'))
        tags.push('narrative');
    if (lower.includes('security') || lower.includes('devops'))
        tags.push('infrastructure');
    if (lower.includes('network') || lower.includes('multiplayer'))
        tags.push('networking');
    if (lower.includes('engine') && !lower.includes('game-engine'))
        tags.push('engine');
    if (lower.includes('community') || lower.includes('localization'))
        tags.push('community');
    if (lower.includes('analytics') || lower.includes('live-ops'))
        tags.push('analytics');
    return tags;
}
/** Infer tags from skill name + description */
function inferSkillTags(name, description) {
    const tags = [];
    const lower = `${name} ${description}`.toLowerCase();
    if (lower.includes('design'))
        tags.push('design');
    if (lower.includes('code') || lower.includes('review') || lower.includes('refactor'))
        tags.push('code-quality');
    if (lower.includes('bug') || lower.includes('triage'))
        tags.push('qa');
    if (lower.includes('test'))
        tags.push('testing');
    if (lower.includes('architecture') || lower.includes('adr'))
        tags.push('architecture');
    if (lower.includes('asset') || lower.includes('art'))
        tags.push('art');
    if (lower.includes('balance') || lower.includes('economy'))
        tags.push('design');
    if (lower.includes('audit'))
        tags.push('qa');
    if (lower.includes('plan') || lower.includes('roadmap'))
        tags.push('planning');
    if (lower.includes('build') || lower.includes('deploy') || lower.includes('ci'))
        tags.push('devops');
    if (lower.includes('doc') || lower.includes('changelog'))
        tags.push('documentation');
    if (lower.includes('brownfield') || lower.includes('onboarding'))
        tags.push('utility');
    if (lower.includes('engine') || lower.includes('cocos') || lower.includes('godot') || lower.includes('unity') || lower.includes('unreal')) {
        tags.push('engine');
    }
    return tags;
}
// ── Stub Generation ──
/** Parse markdown frontmatter */
function parseFM(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match)
        return null;
    try {
        return parseYaml(match[1] ?? '') ?? {};
    }
    catch {
        return null;
    }
}
/** Extract output schema from prompt body (heuristic) */
function extractOutputSchema(body) {
    const output = {};
    // Look for "Output Format" section with JSON
    const outputMatch = body.match(/## Output Format[\s\S]*?```(?:json)?\s*\n([\s\S]*?)```/i);
    if (outputMatch && outputMatch[1]) {
        try {
            const schema = JSON.parse(outputMatch[1]);
            for (const [key, val] of Object.entries(schema)) {
                output[key] = {
                    type: Array.isArray(val) ? 'array' : typeof val,
                    description: `Generated ${key}`,
                };
            }
        }
        catch {
            // Not valid JSON — skip
        }
    }
    // Look for file path patterns
    const pathMatches = body.matchAll(/`([a-z0-9_/-]+\.(?:md|yaml|json))`/gi);
    for (const m of pathMatches) {
        const path = m[1];
        if (path && !output[path]) {
            output[path.replace(/[^a-z0-9_]/gi, '_')] = {
                type: 'string',
                description: `Generated file: ${path}`,
            };
        }
    }
    return Object.keys(output).length > 0 ? output : undefined;
}
/** Extract input schema from description + argument-hint (skills only) */
function extractSkillInput(fm) {
    const input = {};
    const argHint = fm['argument-hint'];
    if (argHint) {
        // Parse "[focus: full | gdds | adrs | stories | infra]"
        const paramMatch = argHint.match(/\[(\w+):\s*(.+)\]/);
        if (paramMatch) {
            const paramName = paramMatch[1] ?? 'focus';
            const options = paramMatch[2] ?? '';
            input[paramName] = {
                type: 'string',
                required: false,
                description: `One of: ${options}`,
            };
        }
    }
    // If no argument hint, add a generic task input
    if (Object.keys(input).length === 0) {
        input['task'] = {
            type: 'string',
            required: false,
            description: `Task description for ${fm.name ?? 'this skill'}`,
        };
    }
    return input;
}
/** Generate MCP stub for an agent */
export function generateAgentStub(filePath, outputDir) {
    if (!existsSync(filePath))
        return null;
    const raw = readFileSync(filePath, 'utf-8');
    const fm = parseFM(raw);
    if (!fm?.name)
        return null;
    const agentFm = fm;
    const body = raw.replace(/^---[\s\S]*?---\r?\n?/, '');
    const name = agentFm.name;
    const tags = inferAgentTags(name, agentFm.description ?? '');
    const outputSchema = extractOutputSchema(body);
    const stubFm = {
        schema: 'aicore-mcp-stub/v2',
        type: 'agent',
        mcp: {
            server: 'codesquad',
            tool: 'agent.invoke',
            params: { name },
        },
        description: agentFm.description ?? '',
        requires_context: {
            gdd: { type: 'string', description: 'Relevant GDD sections for context', required: false },
            code: { type: 'string', description: 'Relevant source code for context', required: false },
        },
        input: {
            task: { type: 'string', required: true, description: `What to ask ${name}` },
            constraints: { type: 'array', items: 'string', required: false, description: 'Scope limits, complexity bounds' },
        },
        ...(outputSchema ? { output: outputSchema } : {}),
        required_config: ['model_config.provider', 'model_config.api_key', 'model_config.model'],
        tags,
    };
    const stubBody = `# ${name} (MCP Stub)

> **This is an MCP client stub.** It maps to \`agent.invoke("${name}", ...)\` on the \`codesquad\` MCP server.
> The full agent definition lives in \`AICore/agents/${name}.md\`.

## Usage

### Via MCP (programmatic)
\`\`\`json
{
  "tool": "agent.invoke",
  "arguments": {
    "name": "${name}",
    "input": { "task": "Your design question here" },
    "model_config": { "provider": "anthropic", "api_key": "sk-...", "model": "claude-sonnet-4-20250514" }
  }
}
\`\`\`

### Via CLI
\`\`\`bash
codesquad mcp stdio  # start server
# then call via MCP client
\`\`\`
`;
    const yamlStr = stringifyYaml(stubFm, { lineWidth: 0, doubleQuotedAsJSON: false });
    const output = `---\n${yamlStr}---\n\n${stubBody}`;
    if (outputDir) {
        const outPath = join(outputDir, `${name}.md`);
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, output, 'utf-8');
        return outPath;
    }
    return output;
}
/** Generate MCP stub for a skill */
export function generateSkillStub(skillDirPath, outputDir) {
    const skillPath = join(skillDirPath, 'SKILL.md');
    if (!existsSync(skillPath))
        return null;
    const raw = readFileSync(skillPath, 'utf-8');
    const fm = parseFM(raw);
    if (!fm?.name)
        return null;
    const skillFm = fm;
    const body = raw.replace(/^---[\s\S]*?---\r?\n?/, '');
    const name = skillFm.name;
    const tags = inferSkillTags(name, skillFm.description ?? '');
    const input = extractSkillInput(fm);
    const outputSchema = extractOutputSchema(body);
    const stubFm = {
        schema: 'aicore-mcp-stub/v2',
        type: 'skill',
        mcp: {
            server: 'codesquad',
            tool: 'skill.invoke',
            params: { name },
        },
        description: skillFm.description ?? '',
        ...(input ? { input } : {}),
        ...(outputSchema ? { output: outputSchema } : {}),
        required_config: ['model_config.provider', 'model_config.api_key', 'model_config.model'],
        tags,
        user_invocable: skillFm['user-invocable'] !== false,
        ...(skillFm['agent'] ? { owner_agent: skillFm['agent'] } : {}),
    };
    const stubBody = `# ${name} (MCP Stub)

> **This is an MCP client stub.** It maps to \`skill.invoke("${name}", ...)\` on the \`codesquad\` MCP server.
> The full skill definition lives in \`AICore/skills/${name}/SKILL.md\`.

## Usage

### Via MCP (programmatic)
\`\`\`json
{
  "tool": "skill.invoke",
  "arguments": {
    "name": "${name}",
    "arguments": {},
    "model_config": { "provider": "anthropic", "api_key": "sk-...", "model": "claude-sonnet-4-20250514" }
  }
}
\`\`\`
`;
    const yamlStr = stringifyYaml(stubFm, { lineWidth: 0, doubleQuotedAsJSON: false });
    const output = `---\n${yamlStr}---\n\n${stubBody}`;
    if (outputDir) {
        const outDir = join(outputDir, 'skills', name);
        mkdirSync(outDir, { recursive: true });
        const outPath = join(outDir, 'SKILL.md');
        writeFileSync(outPath, output, 'utf-8');
        return outPath;
    }
    return output;
}
/** Batch convert all agents */
export function convertAllAgents(outputDir) {
    if (!existsSync(AICORE_AGENTS_DIR)) {
        return { total: 0, converted: 0, errors: ['AICore/agents/ directory not found'] };
    }
    const files = readdirSync(AICORE_AGENTS_DIR)
        .filter(f => extname(f) === '.md');
    const outAgentsDir = join(outputDir, 'agents');
    mkdirSync(outAgentsDir, { recursive: true });
    let converted = 0;
    const errors = [];
    for (const file of files) {
        try {
            const filePath = join(AICORE_AGENTS_DIR, file);
            const result = generateAgentStub(filePath, outAgentsDir);
            if (result)
                converted++;
            else
                errors.push(`Failed to convert: ${file}`);
        }
        catch (err) {
            errors.push(`${file}: ${String(err)}`);
        }
    }
    return { total: files.length, converted, errors };
}
/** Back up AICore/agents/ and AICore/skills/ to a timestamped directory */
export function backupAicore(backupDir) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = resolve(backupDir ?? join(CLI_PACKAGE_ROOT, `.aicore-backup-${timestamp}`));
    mkdirSync(dest, { recursive: true });
    const agentsBackupDir = join(dest, 'agents');
    const skillsBackupDir = join(dest, 'skills');
    let agentCount = 0;
    let skillCount = 0;
    // Backup agents
    if (existsSync(AICORE_AGENTS_DIR)) {
        mkdirSync(agentsBackupDir, { recursive: true });
        const agentFiles = readdirSync(AICORE_AGENTS_DIR).filter(f => extname(f) === '.md');
        for (const f of agentFiles) {
            copyFileSync(join(AICORE_AGENTS_DIR, f), join(agentsBackupDir, f));
            agentCount++;
        }
    }
    // Backup skills
    if (existsSync(AICORE_SKILLS_DIR)) {
        const skillDirs = readdirSync(AICORE_SKILLS_DIR).filter(d => statSync(join(AICORE_SKILLS_DIR, d)).isDirectory());
        for (const dir of skillDirs) {
            const srcPath = join(AICORE_SKILLS_DIR, dir, 'SKILL.md');
            if (existsSync(srcPath)) {
                const destDir = join(skillsBackupDir, dir);
                mkdirSync(destDir, { recursive: true });
                copyFileSync(srcPath, join(destDir, 'SKILL.md'));
                skillCount++;
            }
        }
    }
    return { path: dest, agents: agentCount, skills: skillCount };
}
/**
 * Convert AICore files in-place (DANGEROUS - use backupAicore() first).
 * Replaces .md files in agents/ dir and SKILL.md files in skills/ dir with MCP stubs.
 *
 * WARNING: Per D-02 decision (2026-06-14): only use after @codesquad/aicore-content is ready.
 */
export function convertAicoreInPlace() {
    const errors = [];
    // Convert agents in-place
    let agentCount = 0;
    if (existsSync(AICORE_AGENTS_DIR)) {
        const files = readdirSync(AICORE_AGENTS_DIR).filter(f => extname(f) === '.md');
        for (const file of files) {
            try {
                const filePath = join(AICORE_AGENTS_DIR, file);
                const raw = readFileSync(filePath, 'utf-8');
                const fm = parseFM(raw);
                if (!fm?.name) {
                    errors.push(`No name in: ${file}`);
                    continue;
                }
                const name = fm.name;
                const description = fm.description ?? '';
                const tags = inferAgentTags(name, description);
                const body = raw.replace(/^---[\s\S]*?---\r?\n?/, '');
                const outputSchema = extractOutputSchema(body);
                const stubFm = {
                    schema: 'aicore-mcp-stub/v2',
                    type: 'agent',
                    mcp: { server: 'codesquad', tool: 'agent.invoke', params: { name } },
                    description,
                    requires_context: {
                        gdd: { type: 'string', description: 'Relevant GDD sections for context', required: false },
                        code: { type: 'string', description: 'Relevant source code for context', required: false },
                    },
                    input: {
                        task: { type: 'string', required: true, description: `What to ask ${name}` },
                    },
                    ...(outputSchema ? { output: outputSchema } : {}),
                    required_config: ['model_config.provider', 'model_config.api_key', 'model_config.model'],
                    tags,
                };
                const yamlStr = stringifyYaml(stubFm, { lineWidth: 0, doubleQuotedAsJSON: false });
                const stubBody = `# ${name} (MCP Stub)

> **MCP route**: \`agent.invoke("${name}", ...)\` on \`codesquad\` MCP server.
> Full definition: \`AICore/agents/${name}.md\`

## Usage
\`\`\`json
{ "tool": "agent.invoke", "arguments": { "name": "${name}", "input": {}, "model_config": {} } }
\`\`\`
`;
                writeFileSync(filePath, `---\n${yamlStr}---\n\n${stubBody}`, 'utf-8');
                agentCount++;
            }
            catch (err) {
                errors.push(`${file}: ${String(err)}`);
            }
        }
    }
    // Convert skills in-place
    let skillCount = 0;
    if (existsSync(AICORE_SKILLS_DIR)) {
        const skillDirs = readdirSync(AICORE_SKILLS_DIR).filter(d => statSync(join(AICORE_SKILLS_DIR, d)).isDirectory());
        for (const dir of skillDirs) {
            try {
                const skillPath = join(AICORE_SKILLS_DIR, dir, 'SKILL.md');
                if (!existsSync(skillPath)) {
                    errors.push(`Missing SKILL.md for: ${dir}`);
                    continue;
                }
                const raw = readFileSync(skillPath, 'utf-8');
                const fm = parseFM(raw);
                if (!fm?.name) {
                    errors.push(`No name in: ${dir}/SKILL.md`);
                    continue;
                }
                const name = fm.name;
                const description = fm.description ?? '';
                const tags = inferSkillTags(name, description);
                const body = raw.replace(/^---[\s\S]*?---\r?\n?/, '');
                const input = extractSkillInput(fm);
                const outputSchema = extractOutputSchema(body);
                const stubFm = {
                    schema: 'aicore-mcp-stub/v2',
                    type: 'skill',
                    mcp: { server: 'codesquad', tool: 'skill.invoke', params: { name } },
                    description,
                    ...(input ? { input } : {}),
                    ...(outputSchema ? { output: outputSchema } : {}),
                    required_config: ['model_config.provider', 'model_config.api_key', 'model_config.model'],
                    tags,
                    user_invocable: fm['user-invocable'] !== false,
                };
                const yamlStr = stringifyYaml(stubFm, { lineWidth: 0, doubleQuotedAsJSON: false });
                const stubBody = `# ${name} (MCP Stub)

> **MCP route**: \`skill.invoke("${name}", ...)\` on \`codesquad\` MCP server.
> Full definition: \`AICore/skills/${name}/SKILL.md\`

## Usage
\`\`\`json
{ "tool": "skill.invoke", "arguments": { "name": "${name}", "arguments": {}, "model_config": {} } }
\`\`\`
`;
                writeFileSync(skillPath, `---\n${yamlStr}---\n\n${stubBody}`, 'utf-8');
                skillCount++;
            }
            catch (err) {
                errors.push(`${dir}: ${String(err)}`);
            }
        }
    }
    return { agents: agentCount, skills: skillCount, errors };
}
/** Batch convert all skills */
export function convertAllSkills(outputDir) {
    if (!existsSync(AICORE_SKILLS_DIR)) {
        return { total: 0, converted: 0, errors: ['AICore/skills/ directory not found'] };
    }
    const skillDirs = readdirSync(AICORE_SKILLS_DIR)
        .filter(d => statSync(join(AICORE_SKILLS_DIR, d)).isDirectory());
    let converted = 0;
    const errors = [];
    for (const dir of skillDirs) {
        try {
            const result = generateSkillStub(join(AICORE_SKILLS_DIR, dir), outputDir);
            if (result)
                converted++;
            else
                errors.push(`Failed to convert skill: ${dir}`);
        }
        catch (err) {
            errors.push(`${dir}: ${String(err)}`);
        }
    }
    return { total: skillDirs.length, converted, errors };
}
//# sourceMappingURL=stub-generator.js.map