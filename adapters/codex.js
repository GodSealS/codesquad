/**
 * Codex Adapter
 *
 * Formats agents and skills for Codex CLI.
 * Agent path:  <CODEX_HOME>/agents/{id}.md   (global, not per-project)
 * Skill path:  <CODEX_HOME>/prompts/{id}.md  (global)
 */
import os from 'os';
import path from 'path';
import { buildDefaultModels } from './types.js';
/** Returns the Codex home directory, respecting CODEX_HOME env var */
function getCodexHome() {
    const envHome = process.env.CODEX_HOME?.trim();
    return path.resolve(envHome ? envHome : path.join(os.homedir(), '.codex'));
}
export const codexAdapter = {
    toolId: 'codex',
    getAgentPath(agentId) {
        return path.join(getCodexHome(), 'agents', `${agentId}.md`);
    },
    getSkillPath(skillId) {
        return path.join(getCodexHome(), 'prompts', `${skillId}.md`);
    },
    getSettingsPath() {
        return path.join(getCodexHome(), 'config.json');
    },
    formatAgent(def, effectiveModel) {
        // Codex agents: minimal frontmatter, focuses on body content
        return [
            '---',
            `name: ${def.name}`,
            `description: ${def.description}`,
            `model: ${effectiveModel}`,
            '---',
            '',
            def.body,
        ].join('\n') + '\n';
    },
    formatSkill(def, _effectiveModel) {
        // Codex prompts (skills): description + argument-hint frontmatter
        return [
            '---',
            `description: ${def.description}`,
            def.argumentHint ? `argument-hint: ${def.argumentHint}` : null,
            '---',
            '',
            def.body,
        ]
            .filter((line) => line !== null)
            .join('\n') + '\n';
    },
    formatSettings(_agents, _skills) {
        return JSON.stringify({
            prompts: {
                watch: true,
            },
        }, null, 2) + '\n';
    },
    getDefaultModels: () => buildDefaultModels({
        'DeepSeek-*': 'gpt-4o',
        'Kimi-*': 'gpt-4o',
        'GLM-*': 'gpt-4o-mini',
        'MiniMax-*': 'gpt-4o-mini',
    }, 'gpt-4o'),
};
//# sourceMappingURL=codex.js.map