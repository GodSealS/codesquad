/**
 * SkillTool — Allow agents to dynamically invoke skills during execution.
 *
 * Enabled for all agents. The tool loads a skill's SKILL.md from AICore/skills/
 * and injects its body (instructions) into the session context for subsequent turns.
 *
 * Phase 4 — Chat Feature Gap Fill
 */
import { join } from 'path';
import { z } from 'zod';
import { buildTool } from './types.js';
import { fileExists, fileRead, sanitizeAicorePaths } from '../embedded/virtual-fs.js';
const inputSchema = z.object({
    skill: z.string().describe('Skill ID to invoke (e.g. "brainstorm", "gate-check", "design-review")'),
    args: z.string().optional().describe('Optional arguments passed to the skill'),
});
export const SkillTool = buildTool({
    name: 'Skill',
    description: 'Invoke a skill to get specialized guidance or domain knowledge. ' +
        'Available skills are listed in the system prompt. Use this when you need ' +
        'expert-level assistance for a specific domain (design review, code review, ' +
        'architecture decisions, bug triage, etc.).',
    searchHint: 'skill invoke expert guidance domain knowledge',
    inputSchema,
    prompt() {
        return 'Skill(skill: string, args?: string) — Invoke a named skill to get specialized guidance';
    },
    descriptionFor(input) {
        return `Skill("${input.skill}"${input.args ? `, "${input.args}"` : ''})`;
    },
    isReadOnly() {
        return true;
    },
    isDestructive() {
        return false;
    },
    isConcurrencySafe() {
        return true;
    },
    async call(input, context) {
        const { skill, args } = input;
        // Determine AICore directory from context
        const aicoreDir = context.aicoreDir || join(context.projectRoot, 'AICore');
        // P2 fix: try SKILL.md first, fallback to skill.md (case-insensitive)
        let skillPath = join(aicoreDir, 'skills', skill, 'SKILL.md');
        const skillPathAlt = join(aicoreDir, 'skills', skill, 'skill.md');
        // Use virtual-fs to check existence (supports embedded AICore in published builds)
        if (!fileExists(skillPath)) {
            if (fileExists(skillPathAlt)) {
                skillPath = skillPathAlt;
            }
            else {
                return {
                    toolCallId: crypto.randomUUID(),
                    output: null,
                    content: `[Skill Not Found] No skill named "${skill}". Check the skill ID and try again.`,
                    isError: true,
                };
            }
        }
        try {
            // Use assembleSkillContent to auto-match sub-files based on args context
            const { assembleSkillContent } = await import('../repl/skill-registry.js');
            const assembledBody = assembleSkillContent(skill, args || context.session.messages.slice(-3).map(m => m.content).join(' '));
            // Use virtual-fs for reading (supports embedded AICore in published builds)
            const rawContent = assembledBody || fileRead(skillPath);
            // Inject skill body (with matched sub-files) into session context for subsequent turns
            const sanitized = sanitizeAicorePaths(rawContent);
            const injected = `\n## Activated Skill: ${skill}\n${args ? `Args: ${args}\n` : ''}\n${sanitized}\n`;
            context.session.context.injectedContent =
                (context.session.context.injectedContent || '') + injected;
            // Return a concise summary to the agent (not the full body, which is now in context)
            const firstPara = rawContent.split('\n\n')[0]?.replace(/^#+\s*/gm, '').slice(0, 200) || skill;
            return {
                toolCallId: crypto.randomUUID(),
                output: { skill, args, loaded: true },
                content: `[Skill Activated: ${skill}] ${firstPara}...\nFull skill instructions have been injected into the conversation context. Follow them for your subsequent responses.`,
                contextModifier: {
                    injectedContent: context.session.context.injectedContent,
                },
            };
        }
        catch (err) {
            return {
                toolCallId: crypto.randomUUID(),
                output: null,
                content: `[Skill Error] Failed to load skill "${skill}": ${err.message}`,
                isError: true,
            };
        }
    },
});
//# sourceMappingURL=SkillTool.js.map