/**
 * CodeBuddy Adapter
 *
 * Formats agents and skills for CodeBuddy Code (CLI).
 * Agent path:  .codesquad/agents/{id}.md
 * Skill path:  .codesquad/skills/{id}/SKILL.md
 * Settings:    .codesquad/settings.json
 *
 * Outputs full prompt body for agent/skill to run standalone in IDE.
 */
import path from 'path';
import { buildDefaultModels } from './types.js';
function escapeYaml(value) {
    const needsQuoting = /[:\n\r#{}[\],&*!|>'"%@`]|^\s|\s$/.test(value);
    if (needsQuoting) {
        const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        return `"${escaped}"`;
    }
    return value;
}
function formatSkillsArray(skills) {
    if (!skills || skills.length === 0)
        return '[]';
    return `[${skills.join(', ')}]`;
}
export const codebuddyAdapter = {
    toolId: 'codebuddy',
    getAgentPath(agentId) {
        return path.join('.codesquad', 'agents', `${agentId}.md`);
    },
    getSkillPath(skillId) {
        return path.join('.codesquad', 'skills', skillId, 'SKILL.md');
    },
    getSettingsPath() {
        return path.join('.codesquad', 'settings.json');
    },
    getSettingsSchemaUrl() {
        return 'https://www.codebuddy.cn/docs/cli/settings';
    },
    formatAgent(def, effectiveModel) {
        const skillsStr = formatSkillsArray(def.skills);
        return [
            '---',
            `name: ${escapeYaml(def.name)}`,
            `description: ${escapeYaml(def.description)}`,
            `tools: ${escapeYaml(def.tools)}`,
            `model: ${escapeYaml(effectiveModel)}`,
            def.maxTurns !== undefined ? `maxTurns: ${def.maxTurns}` : null,
            def.disallowedTools ? `disallowedTools: ${escapeYaml(def.disallowedTools)}` : null,
            skillsStr !== '[]' ? `skills: ${skillsStr}` : null,
            def.memory ? `memory: ${escapeYaml(def.memory)}` : null,
            def.agentMode ? `agentMode: ${escapeYaml(def.agentMode)}` : null,
            def.enabled !== undefined ? `enabled: ${def.enabled}` : null,
            def.enabledAutoRun !== undefined ? `enabledAutoRun: ${def.enabledAutoRun}` : null,
            '---',
            '',
            def.body,
        ]
            .filter((line) => line !== null)
            .join('\n') + '\n';
    },
    formatSkill(def, effectiveModel) {
        return [
            '---',
            `name: ${escapeYaml(def.name)}`,
            `description: ${escapeYaml(def.description)}`,
            def.descriptionCn ? `description_cn: ${escapeYaml(def.descriptionCn)}` : null,
            def.argumentHint ? `argument-hint: "${def.argumentHint}"` : null,
            def.userInvocable !== undefined ? `user-invocable: ${def.userInvocable}` : null,
            def.allowedTools ? `allowed-tools: ${escapeYaml(def.allowedTools)}` : null,
            def.type ? `type: ${escapeYaml(def.type)}` : null,
            def.bindTo && def.bindTo.length > 0
                ? `bind-to: ${def.bindTo.map(b => escapeYaml(b)).join(', ')}` : null,
            def.agent ? `agent: ${escapeYaml(def.agent)}` : null,
            effectiveModel !== 'unknown' ? `model: ${escapeYaml(effectiveModel)}` : null,
            def.maxTokens !== undefined ? `max-tokens: ${def.maxTokens}` : null,
            def.thinkingLevel ? `thinking-level: ${escapeYaml(def.thinkingLevel)}` : null,
            def.context ? `context: ${escapeYaml(def.context)}` : null,
            '---',
            '',
            def.body,
        ]
            .filter((line) => line !== null)
            .join('\n') + '\n';
    },
    formatSettings(_agents, _skills) {
        // CodeBuddy settings are complex and typically hand-maintained.
        // We generate a minimal settings stub here.
        return JSON.stringify({
            $schema: this.getSettingsSchemaUrl?.(),
            permissions: {
                allow: ['Bash(git *)', 'Bash(ls *)', 'Bash(dir *)', 'Read(*)', 'Write(*)', 'Edit(*)'],
                deny: ['Bash(rm -rf *)', 'Bash(sudo *)'],
            },
            sandbox: {
                enabled: true,
                autoAllowBashIfSandboxed: true,
            },
        }, null, 2) + '\n';
    },
    getDefaultModels: () => buildDefaultModels(),
};
//# sourceMappingURL=codebuddy.js.map