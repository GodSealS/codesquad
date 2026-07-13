/**
 * Assembly Parser — parses `.assembly.md` files and merges with parent agents.
 *
 * Assembly files declare inheritance from a base agent via frontmatter,
 * superimposing skills, tools, model overrides, and body content.
 *
 * References:
 *   Idea/tutrue/agent-assembly-design.md §3.2
 *   Idea/tutrue/.out/implementation-plan.md A-Task 2
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
// ── Frontmatter Regex ──
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
// ── Error types ──
export class AssemblyError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AssemblyError';
    }
}
// ── parseAssemblyFile ──
/**
 * Parse a `.assembly.md` file's frontmatter (without body).
 * Called at startup for lightweight metadata loading.
 */
export function parseAssemblyFile(filePath, options) {
    const raw = readFileSync(filePath, 'utf-8');
    const match = raw.match(FRONTMATTER_RE);
    if (!match) {
        throw new AssemblyError(`Invalid assembly file: no frontmatter found in ${filePath}`);
    }
    const [, rawFm, rawBody] = match;
    const fm = parseYaml(rawFm ?? '');
    // Validate required fields
    if (!fm.agent_parent || typeof fm.agent_parent !== 'string') {
        throw new AssemblyError(`Assembly file missing required 'agent_parent' field in ${filePath}`);
    }
    if (!fm.name || typeof fm.name !== 'string') {
        throw new AssemblyError(`Assembly file missing required 'name' field in ${filePath}`);
    }
    if (!fm.description || typeof fm.description !== 'string') {
        throw new AssemblyError(`Assembly '${fm.name}' missing required 'description' field in ${filePath}`);
    }
    // Validate agent_parent constraints
    const agentParent = fm.agent_parent;
    const assemblyName = fm.name;
    // Circular: agent_parent cannot point to self
    if (agentParent === assemblyName) {
        throw new AssemblyError(`agent_parent '${agentParent}' cannot point to self in ${filePath}`);
    }
    // Circular: agent_parent cannot point to another assembly file
    if (options?.agentsDir) {
        try {
            const files = readdirSync(options.agentsDir).filter((f) => f.endsWith('.assembly.md'));
            for (const file of files) {
                if (join(options.agentsDir, file) === filePath)
                    continue; // skip self
                try {
                    const otherRaw = readFileSync(join(options.agentsDir, file), 'utf-8');
                    const otherMatch = otherRaw.match(FRONTMATTER_RE);
                    if (otherMatch) {
                        const otherFm = parseYaml(otherMatch[1]);
                        if (otherFm.name === agentParent) {
                            throw new AssemblyError(`agent_parent '${agentParent}' points to an assembly agent '${file}' — circular inheritance not allowed`);
                        }
                    }
                }
                catch (e) {
                    if (e instanceof AssemblyError)
                        throw e;
                    // Skip unreadable files
                }
            }
        }
        catch (e) {
            if (e instanceof AssemblyError)
                throw e;
            // Directory may not exist — validation will happen in resolveAssemblyBody
        }
    }
    // Build AssemblyMeta
    const bodyContent = (rawBody ?? '').trim();
    const assemblyMeta = {
        name: assemblyName,
        description: fm.description,
        agent_parent: agentParent,
        body_mode: fm.body_mode ?? 'append',
    };
    // Optional fields
    if (fm.skills && Array.isArray(fm.skills)) {
        assemblyMeta.skills = fm.skills;
    }
    if (fm.model !== undefined)
        assemblyMeta.model = fm.model;
    if (fm.maxTurns !== undefined)
        assemblyMeta.maxTurns = fm.maxTurns;
    if (fm.tools !== undefined)
        assemblyMeta.tools = fm.tools;
    if (fm.disallowedTools !== undefined)
        assemblyMeta.disallowedTools = fm.disallowedTools;
    if (fm.memory !== undefined)
        assemblyMeta.memory = fm.memory;
    if (fm.instanceId !== undefined)
        assemblyMeta.instanceId = fm.instanceId;
    if (fm.enabled !== undefined)
        assemblyMeta.enabled = fm.enabled;
    if (fm.enabledAutoRun !== undefined)
        assemblyMeta.enabledAutoRun = fm.enabledAutoRun;
    if (fm.agentMode !== undefined)
        assemblyMeta.agentMode = fm.agentMode;
    if (fm.thinkingLevel !== undefined) {
        assemblyMeta.thinkingLevel = fm.thinkingLevel;
    }
    if (bodyContent.length > 0) {
        assemblyMeta.body = bodyContent;
    }
    return assemblyMeta;
}
// ── resolveAssemblyBody ──
/**
 * Merge an AssemblyMeta with its parent AgentDef to produce a complete agent.
 * Called on first use (lazy body loading).
 */
export function resolveAssemblyBody(meta, parent) {
    // Merge skills: union with dedup (preserve parent order, append new from assembly)
    const parentSkills = parent.skills ?? [];
    const assemblySkills = meta.skills ?? [];
    const skillsSet = new Set(parentSkills);
    const mergedSkills = [...parentSkills];
    for (const s of assemblySkills) {
        if (!skillsSet.has(s)) {
            mergedSkills.push(s);
            skillsSet.add(s);
        }
    }
    // Merge disallowedTools: union with dedup
    const parentDisallowed = parent.disallowedTools
        ? parent.disallowedTools.split(',').map((t) => t.trim()).filter(Boolean)
        : [];
    const assemblyDisallowed = meta.disallowedTools
        ? meta.disallowedTools.split(',').map((t) => t.trim()).filter(Boolean)
        : [];
    const disallowedSet = new Set([...parentDisallowed, ...assemblyDisallowed]);
    const mergedDisallowed = [...disallowedSet].join(', ');
    // Body: based on body_mode
    let mergedBody;
    if (meta.body_mode === 'replace') {
        if (!meta.body || meta.body.length === 0) {
            console.warn(`[Assembly] body_mode: replace specified but no body provided for '${meta.name}'. Falling back to parent body.`);
            mergedBody = parent.body;
        }
        else {
            mergedBody = meta.body;
        }
    }
    else {
        // Default: append
        if (meta.body && meta.body.length > 0) {
            mergedBody = `${parent.body}\n\n${meta.body}`;
        }
        else {
            mergedBody = parent.body;
        }
    }
    // Build resolved AgentDef
    // Override fields: assembly value takes precedence, otherwise inherit from parent
    const resolved = {
        name: meta.name,
        description: meta.description,
        // tools: assembly > parent > default
        tools: meta.tools ?? parent.tools,
        // model: assembly > parent
        model: meta.model ?? parent.model,
        // maxTurns: assembly > parent
        maxTurns: meta.maxTurns ?? parent.maxTurns,
        // disallowedTools: merged
        disallowedTools: mergedDisallowed.length > 0 ? mergedDisallowed : undefined,
        // skills: merged
        skills: mergedSkills.length > 0 ? mergedSkills : undefined,
        // memory: assembly > parent (assembly can add memory when parent doesn't have it)
        memory: meta.memory ?? parent.memory,
        // agentMode: assembly > parent
        agentMode: meta.agentMode ?? parent.agentMode,
        // enabled: independent (assembly value, otherwise inherit)
        enabled: meta.enabled ?? parent.enabled,
        // enabledAutoRun: assembly > parent
        enabledAutoRun: meta.enabledAutoRun ?? parent.enabledAutoRun,
        // thinkingLevel: assembly > parent
        thinkingLevel: meta.thinkingLevel ?? parent.thinkingLevel,
        // Assembly-specific fields
        agent_parent: meta.agent_parent,
        instanceId: meta.instanceId,
        body_mode: meta.body_mode,
        isAssembly: true,
        // Merged body
        body: mergedBody,
        extra: parent.extra ?? {},
    };
    return resolved;
}
//# sourceMappingURL=assembly-parser.js.map