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
import { type SkillFrontmatter } from './skill-frontmatter.js';
/** Loaded skill with frontmatter resolved. */
export interface LoadedSkill extends SkillFrontmatter {
    dirName: string;
    layer?: 'user' | 'project';
    sourcePath?: string;
}
export declare function setAicodeRoot(dir: string): void;
/** Load and cache all skills from all three layers. */
export declare function listSkills(): LoadedSkill[];
/** Load a single skill by name. */
export declare function loadSkill(name: string): LoadedSkill | null;
/** Filter to only user-invocable skills. */
export declare function filterUserInvocable(skills: LoadedSkill[]): LoadedSkill[];
/**
 * Get skill tool commands — matching Claude Code's getSkillToolCommands signature.
 * Returns skills the model can invoke (user-invocable, with description).
 */
export declare function getSkillToolCommands(): LoadedSkill[];
/**
 * Resolve the best description for a skill based on the user's language.
 * Uses description_cn when lang is Chinese and available, otherwise falls back to description.
 */
export declare function getSkillDescription(skill: LoadedSkill, lang?: string): string;
/**
 * Build a concise skill listing for system prompt injection.
 * References Claude Code's `getUsingYourToolsSection` bullet format.
 * Cached per-language — only rebuilt when skill cache is invalidated.
 *
 * @param maxSkills - Max number of skills to include in the listing
 * @param lang - Language preference: 'zh' (Chinese), 'en' (English), or undefined (defaults to zh)
 */
export declare function buildSkillGuidance(maxSkills?: number, lang?: string): string | null;
/** Invalidate both skill and guidance caches. */
export declare function clearSkillCache(): void;
/**
 * Get all capability skills bound to a specific agent.
 * These skills extend the agent's abilities and are auto-injected into its system prompt.
 *
 * Resolution order:
 *   1. Skills with `bind-to: agentName` in frontmatter
 *   2. Skills with `type: capability` that don't have bind-to (fallback: any capability)
 */
export declare function getCapabilitySkillsForAgent(agentName: string): LoadedSkill[];
/**
 * Load the content of a sub-file within a multi-file skill.
 * Sub-files are lazy-loaded on demand based on trigger keyword matching.
 *
 * @param skillName - The skill directory name (e.g., "cocos_editor")
 * @param subFileName - The sub-file stem (e.g., "workflow-character")
 * @returns The sub-file content, or null if not found
 */
export declare function loadSubFileContent(skillName: string, subFileName: string): string | null;
/**
 * Match trigger keywords against a skill's sub-files and return matching file names.
 * Used to auto-assemble the right sub-skills based on user input context.
 *
 * @param skillName - The skill directory name
 * @param keywords - Space-separated trigger keywords from user input
 * @returns Array of matched sub-file names (stems without .md)
 */
export declare function matchSubFiles(skillName: string, keywords: string): string[];
/**
 * Build capability skill guidance for injection into an agent's system prompt.
 * Lists all capability skills available to this agent with their descriptions and sub-files.
 *
 * @param agentName - The agent to get capability skills for
 * @param lang - Language preference
 */
export declare function buildCapabilitySkillGuidance(agentName: string, lang?: string): string | null;
/**
 * Resolve which sub-files to load for a given user request context.
 * Returns the assembled content: main SKILL.md body + matched sub-file contents.
 *
 * @param skillName - The skill to load
 * @param userContext - User's request text for trigger keyword matching
 * @returns Assembled skill content (main body + matched sub-files), or null
 */
export declare function assembleSkillContent(skillName: string, userContext?: string): string | null;
//# sourceMappingURL=skill-registry.d.ts.map