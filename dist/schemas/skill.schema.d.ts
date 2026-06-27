/**
 * Skill MD Parser
 *
 * Parses YAML frontmatter + body from skill markdown files.
 * Format: skills/<name>/SKILL.md
 */
import type { SkillDef } from '../adapters/types.js';
/**
 * Parse a raw skill markdown string into a SkillDef.
 */
export declare function parseSkillMd(content: string, sourcePath?: string): SkillDef;
/**
 * Read and parse a skill markdown file from disk.
 */
export declare function readSkillMd(filePath: string): SkillDef;
//# sourceMappingURL=skill.schema.d.ts.map