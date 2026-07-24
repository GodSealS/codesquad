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
/** Skill type determines execution mode and agent binding. */
export type SkillType = 'workflow' | 'capability';
/** Metadata for a sub-file in a multi-file skill. */
export interface SkillSubFile {
    /** File stem (e.g., "workflow-character"). */
    name: string;
    /** Relative path within the skill directory. */
    path: string;
    /** Trigger keywords that cause this sub-file to be loaded. */
    triggers: string[];
}
export interface SkillFrontmatter {
    name: string;
    /** English description (shown when lang !== 'zh'). */
    description: string;
    /** Chinese description (shown when lang === 'zh' and description_cn is set). */
    descriptionCn: string;
    argumentHint: string;
    userInvocable: boolean;
    allowedTools: string[];
    /** Skill type: workflow (standalone guided flow) or capability (extends an agent). */
    type: SkillType;
    /** Agent names this capability skill is bound to. Only relevant for type=capability. */
    bindTo: string[];
    category?: string;
    agent?: string;
    model?: string;
    /** Override default maxTokens for LLM output (works for skill-only execution, not agent-routed). */
    maxTokens?: number;
    /** Override agent's thinking level: fast (no reasoning), think (medium), deep (extended). Defaults to agent's own setting. */
    thinkingLevel?: 'fast' | 'think' | 'deep';
    /** Sub-files for multi-file skills (lazy-loaded on demand based on trigger keywords). */
    subFiles: SkillSubFile[];
    /** Execution context: 'fork' means run in isolated context, return only summary. */
    context?: string;
    /** Explicit complexity override for the execution classifier.
     *  - 'simple': sequential execution, no routing, no popup
     *  - 'complex': AI auto-matches to agent(s), may create team
     *  - 'important': popup for human decision (affects project structure/direction)
     *  When omitted, the system auto-classifies via heuristic rules. */
    complexity?: 'simple' | 'complex' | 'important';
    /** Areas impacted by this skill (architecture, direction, production, etc.).
     *  Used by the classifier to decide between 'complex' and 'important'. */
    impactArea?: string[];
    /** Raw SKILL.md body (everything after frontmatter). */
    body: string;
}
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
export declare function parseSkillFrontmatter(raw: string, dirPath?: string): SkillFrontmatter;
//# sourceMappingURL=skill-frontmatter.d.ts.map