/**
 * Skill registry — scans skills from three layers (AICore → User → Project).
 *
 * Two skill types:
 *   - workflow: Standalone multi-step guided workflow (user-invocable, /skill-name)
 *   - capability: Extends a specific agent's abilities (bind-to: agent1, agent2)
 *
 * Multi-file skills: sub-files in the skill directory are auto-discovered.
 * The main SKILL.md's "Workflow Routing" table maps trigger keywords → sub-files.
 *
 * References Claude Code's getSkillToolCommands / getSlashCommandToolSkills.
 * Phase C2 + P0 enhancement.
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { parseSkillFrontmatter } from './skill-frontmatter.js';
import { getCodeSquadProjectCategory, getCodeSquadUserCategory, isEmbeddedMode, readAicoreFile, readAicoreDir } from '../core/paths.js';
import { virtualExists } from '../embedded/virtual-fs.js';
// ── Cache ──
let skillCache = null;
let _aicodeRoot = null;
export function setAicodeRoot(dir) {
    _aicodeRoot = dir;
    skillCache = null;
}
function skillRoot() {
    if (_aicodeRoot)
        return join(_aicodeRoot, 'skills');
    return join(process.cwd(), 'AICore', 'skills');
}
/** Get both skill source dirs: AICore/skills/ + ~/.codesquad/skills/ + project .codesquad/skills/ */
function getAllSkillDirs() {
    const dirs = [];
    const aicoreDir = skillRoot();
    // Embedded mode: AICore is not on disk, but available via readAicoreDir / VirtualFS
    if (isEmbeddedMode() || virtualExists(aicoreDir))
        dirs.push(aicoreDir);
    // User home directory skill installs (e.g. graphify install --platform codesquad)
    if (existsSync(getCodeSquadUserCategory('skills')))
        dirs.push(getCodeSquadUserCategory('skills'));
    const projectDir = getCodeSquadProjectCategory('skills');
    if (existsSync(projectDir))
        dirs.push(projectDir);
    return dirs;
}
// ── Registry ──
/** Load and cache all skills from all three layers. */
export function listSkills() {
    if (skillCache)
        return skillCache;
    const seen = new Map();
    const skillDirs = getAllSkillDirs();
    // Layer label mapping by position in getAllSkillDirs():
    //   [0] = AICore/skills/  → undefined (system, no badge)
    //   [1] = ~/.codesquad/skills/ → 'user'
    //   [2] = .codesquad/skills/   → 'project'
    const layerByIndex = [undefined, 'user', 'project'];
    // Iterate in priority order (later overrides earlier)
    for (let i = 0; i < skillDirs.length; i++) {
        const root = skillDirs[i];
        const layer = layerByIndex[i];
        // ── Layer 0 (AICore built-in): use readAicoreDir/readAicoreFile (VirtualFS) ──
        if (i === 0) {
            const entries = readAicoreDir('skills');
            for (const entry of entries) {
                // Try SKILL.md first, fallback to skill.md
                let content = readAicoreFile(`skills/${entry}/SKILL.md`);
                if (content === null) {
                    content = readAicoreFile(`skills/${entry}/skill.md`);
                    if (content === null)
                        continue;
                }
                try {
                    const fm = parseSkillFrontmatter(content, entry);
                    seen.set(entry, { ...fm, dirName: entry, layer, sourcePath: `skills/${entry}` });
                }
                catch {
                    // Skip unreadable skills
                }
            }
            continue;
        }
        // ── Disk layers (user/project) ──
        try {
            const entries = readdirSync(root, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory())
                    continue;
                // P2 fix: try SKILL.md first, fallback to skill.md
                let skillPath = join(root, entry.name, 'SKILL.md');
                if (!existsSync(skillPath)) {
                    const altPath = join(root, entry.name, 'skill.md');
                    if (existsSync(altPath))
                        skillPath = altPath;
                    else
                        continue;
                }
                try {
                    const raw = readFileSync(skillPath, 'utf-8');
                    const skillDir = join(root, entry.name);
                    const fm = parseSkillFrontmatter(raw, skillDir); // Pass dirPath for sub-file auto-discovery
                    seen.set(entry.name, { ...fm, dirName: entry.name, layer, sourcePath: skillDir });
                }
                catch {
                    // Skip unreadable skills
                }
            }
        }
        catch {
            // Directory may not exist
        }
    }
    skillCache = Array.from(seen.values());
    return skillCache;
}
/** Load a single skill by name. */
export function loadSkill(name) {
    return listSkills().find((s) => s.dirName === name) ?? null;
}
/** Filter to only user-invocable skills. */
export function filterUserInvocable(skills) {
    return skills.filter((s) => s.userInvocable);
}
/**
 * Get skill tool commands — matching Claude Code's getSkillToolCommands signature.
 * Returns skills the model can invoke (user-invocable, with description).
 */
export function getSkillToolCommands() {
    return listSkills().filter((s) => s.userInvocable && (s.description || s.descriptionCn || s.body));
}
// ── Guidance cache (per-language) ──
const guidanceCache = new Map();
/** Invalidate the guidance cache (called by clearSkillCache). */
function invalidateGuidance() {
    guidanceCache.clear();
}
/**
 * Resolve the best description for a skill based on the user's language.
 * Uses description_cn when lang is Chinese and available, otherwise falls back to description.
 */
export function getSkillDescription(skill, lang) {
    // lang === 'en' means user explicitly chose English; otherwise default to Chinese
    const useZh = lang !== 'en';
    if (useZh && skill.descriptionCn) {
        return skill.descriptionCn;
    }
    return skill.description;
}
/**
 * Build a concise skill listing for system prompt injection.
 * References Claude Code's `getUsingYourToolsSection` bullet format.
 * Cached per-language — only rebuilt when skill cache is invalidated.
 *
 * @param maxSkills - Max number of skills to include in the listing
 * @param lang - Language preference: 'zh' (Chinese), 'en' (English), or undefined (defaults to zh)
 */
export function buildSkillGuidance(maxSkills = 8, lang) {
    const cacheKey = `guidance_${lang ?? 'zh'}_${maxSkills}`;
    const cached = guidanceCache.get(cacheKey);
    if (cached !== undefined)
        return cached || null;
    const skills = getSkillToolCommands();
    if (skills.length === 0) {
        guidanceCache.set(cacheKey, '');
        return null;
    }
    const useZh = !lang || lang !== 'en';
    const title = useZh ? '## 可用技能' : '## Available Skills';
    const moreText = useZh
        ? `- ... 还有 ${skills.length - maxSkills} 个技能，输入 /skills 查看全部`
        : `- ... ${skills.length - maxSkills} more skills, type /skills to view all`;
    const lines = [title];
    const shown = skills.slice(0, maxSkills);
    for (const s of shown) {
        const rawDesc = getSkillDescription(s, lang);
        const desc = rawDesc
            ? ` — ${rawDesc.slice(0, 80)}`
            : '';
        const arg = s.argumentHint ? ` ${s.argumentHint}` : '';
        lines.push(`- \`/${s.dirName}${arg}\`${desc}`);
    }
    if (skills.length > maxSkills) {
        lines.push(moreText);
    }
    const result = lines.join('\n');
    guidanceCache.set(cacheKey, result);
    return result;
}
/** Invalidate both skill and guidance caches. */
export function clearSkillCache() {
    skillCache = null;
    invalidateGuidance();
}
// ── Capability Skill Binding ──
/**
 * Get all capability skills bound to a specific agent.
 * These skills extend the agent's abilities and are auto-injected into its system prompt.
 *
 * Resolution order:
 *   1. Skills with `bind-to: agentName` in frontmatter
 *   2. Skills with `type: capability` that don't have bind-to (fallback: any capability)
 */
export function getCapabilitySkillsForAgent(agentName) {
    const all = listSkills();
    return all.filter((s) => {
        if (s.type !== 'capability')
            return false;
        // If bindTo is specified, only match if agentName is in the list
        if (s.bindTo.length > 0) {
            return s.bindTo.includes(agentName);
        }
        // No bindTo specified — available to any agent (but user must not invoke directly)
        return true;
    });
}
/**
 * Load the content of a sub-file within a multi-file skill.
 * Sub-files are lazy-loaded on demand based on trigger keyword matching.
 *
 * @param skillName - The skill directory name (e.g., "cocos_editor")
 * @param subFileName - The sub-file stem (e.g., "workflow-character")
 * @returns The sub-file content, or null if not found
 */
export function loadSubFileContent(skillName, subFileName) {
    const skill = loadSkill(skillName);
    if (!skill || !skill.sourcePath)
        return null;
    const subFile = skill.subFiles.find((sf) => sf.name === subFileName || sf.name === subFileName.replace(/\.md$/, ''));
    if (!subFile)
        return null;
    try {
        return readFileSync(subFile.path, 'utf-8');
    }
    catch {
        return null;
    }
}
/**
 * Match trigger keywords against a skill's sub-files and return matching file names.
 * Used to auto-assemble the right sub-skills based on user input context.
 *
 * @param skillName - The skill directory name
 * @param keywords - Space-separated trigger keywords from user input
 * @returns Array of matched sub-file names (stems without .md)
 */
export function matchSubFiles(skillName, keywords) {
    const skill = loadSkill(skillName);
    if (!skill || skill.subFiles.length === 0)
        return [];
    const kwLower = keywords.toLowerCase();
    const matched = [];
    for (const sf of skill.subFiles) {
        for (const trigger of sf.triggers) {
            // Use word-boundary matching to avoid false positives.
            // Short triggers like "ui" would match "build"/"guide" without boundaries.
            // Multi-word triggers like "progress bar" require both words present.
            if (matchTrigger(kwLower, trigger)) {
                if (!matched.includes(sf.name)) {
                    matched.push(sf.name);
                }
                break;
            }
        }
    }
    return matched;
}
/**
 * Match a trigger keyword against user input with word-boundary awareness.
 *
 * Rules:
 *   - Multi-word triggers (e.g., "progress bar"): all words must appear in input
 *   - Single-word triggers < 3 chars (e.g., "ui", "vfx"): must be a whole word (boundary match)
 *   - Single-word triggers >= 3 chars (e.g., "character", "widget"): substring match OK
 */
function matchTrigger(input, trigger) {
    const words = trigger.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
        // Multi-word: all words must be substrings of input
        return words.every((w) => input.includes(w));
    }
    // Single word
    if (trigger.length < 3) {
        // Short trigger (1-2 chars): require word boundary
        const re = new RegExp(`\\b${escapeRegex(trigger)}\\b`, 'i');
        return re.test(input);
    }
    // Normal trigger (>= 3 chars): substring match
    return input.includes(trigger);
}
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Build capability skill guidance for injection into an agent's system prompt.
 * Lists all capability skills available to this agent with their descriptions and sub-files.
 *
 * @param agentName - The agent to get capability skills for
 * @param lang - Language preference
 */
export function buildCapabilitySkillGuidance(agentName, lang) {
    const capSkills = getCapabilitySkillsForAgent(agentName);
    if (capSkills.length === 0)
        return null;
    const useZh = !lang || lang !== 'en';
    const title = useZh
        ? '## 可用领域能力 (Agent Skills)'
        : '## Available Domain Capabilities (Agent Skills)';
    const lines = [title];
    lines.push(useZh
        ? '通过 `UseSkill("skill-name")` 加载对应能力。加载后 Skill 内容注入对话上下文。'
        : 'Load capabilities via `UseSkill("skill-name")`. Content is injected into conversation context on load.');
    lines.push('');
    for (const s of capSkills) {
        const desc = getSkillDescription(s, lang) || s.description;
        const shortDesc = desc ? ` — ${desc.slice(0, 100)}` : '';
        lines.push(`- **\`${s.dirName}\`**${shortDesc}`);
        if (s.subFiles.length > 0) {
            const sfNames = s.subFiles.map((sf) => `\`${sf.name}\``).join(', ');
            lines.push(`  子能力: ${sfNames}`);
        }
    }
    return lines.join('\n');
}
/**
 * Resolve which sub-files to load for a given user request context.
 * Returns the assembled content: main SKILL.md body + matched sub-file contents.
 *
 * @param skillName - The skill to load
 * @param userContext - User's request text for trigger keyword matching
 * @returns Assembled skill content (main body + matched sub-files), or null
 */
export function assembleSkillContent(skillName, userContext) {
    const skill = loadSkill(skillName);
    if (!skill)
        return null;
    let content = skill.body;
    // Match and load sub-files based on user context keywords
    if (userContext && skill.subFiles.length > 0) {
        const matched = matchSubFiles(skillName, userContext);
        for (const sfName of matched) {
            const sfContent = loadSubFileContent(skillName, sfName);
            if (sfContent) {
                content += `\n\n---\n## Sub-Workflow: ${sfName}\n${sfContent}`;
            }
        }
    }
    return content;
}
//# sourceMappingURL=skill-registry.js.map