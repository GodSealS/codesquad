/**
 * Claude Code Adapter
 *
 * Formats agents and skills for Claude Code.
 * Agent path:  .claude/agents/{id}.md
 * Skill path:  .claude/commands/{id}.md
 */
import path from 'path';
import { buildDefaultModels } from './types.js';
function escapeYamlValue(value) {
    const needsQuoting = /[:\n\r#{}[\],&*!|>'"%@`]|^\s|\s$/.test(value);
    if (needsQuoting) {
        const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        return `"${escaped}"`;
    }
    return value;
}
export const claudeAdapter = {
    toolId: 'claude',
    getAgentPath(agentId) {
        return path.join('.claude', 'agents', `${agentId}.md`);
    },
    getSkillPath(skillId) {
        // Claude Code uses commands directory for slash commands
        return path.join('.claude', 'commands', `${skillId}.md`);
    },
    getSettingsPath() {
        return path.join('.claude', 'settings.json');
    },
    formatAgent(def, effectiveModel) {
        // Claude Code agents use a simplified frontmatter
        return [
            '---',
            `name: ${escapeYamlValue(def.name)}`,
            `description: ${escapeYamlValue(def.description)}`,
            `model: ${escapeYamlValue(effectiveModel)}`,
            `tools: ${escapeYamlValue(def.tools)}`,
            def.maxTurns !== undefined ? `maxTurns: ${def.maxTurns}` : null,
            '---',
            '',
            def.body,
        ]
            .filter((line) => line !== null)
            .join('\n') + '\n';
    },
    formatSkill(def, effectiveModel) {
        // Claude Code skills are formatted as slash commands
        return [
            '---',
            `name: ${escapeYamlValue(def.name)}`,
            `description: ${escapeYamlValue(def.description)}`,
            `category: Game Development`,
            effectiveModel !== 'unknown' ? `model: ${escapeYamlValue(effectiveModel)}` : null,
            def.argumentHint ? `argument-hint: ${escapeYamlValue(def.argumentHint)}` : null,
            '---',
            '',
            def.body,
        ]
            .filter((line) => line !== null)
            .join('\n') + '\n';
    },
    formatSettings(_agents, _skills) {
        return JSON.stringify({
            permissions: {
                allow: ['Bash(git *)', 'Read', 'Write', 'Edit'],
            },
        }, null, 2) + '\n';
    },
    getDefaultModels: () => buildDefaultModels({
        'DeepSeek-*': 'claude-sonnet-4-20250514',
        'Kimi-*': 'claude-sonnet-4-20250514',
        'GLM-*': 'claude-haiku-3-5',
        'MiniMax-*': 'claude-haiku-3-5',
    }, 'claude-sonnet-4-20250514'),
};
//# sourceMappingURL=claude.js.map