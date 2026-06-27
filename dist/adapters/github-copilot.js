// GitHub Copilot adapter
import path from 'path';
import { buildDefaultModels } from './types.js';
function e(text) {
    const needsQuoting = /[:\n\r#{}[\],&*!|>'"%@`]|^\s|\s$/.test(text);
    return needsQuoting ? `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"` : text;
}
export const githubCopilotAdapter = {
    toolId: 'github-copilot',
    getAgentPath(id) { return path.join('.github', 'agents', `${id}.md`); },
    getSkillPath(id) { return path.join('.github', 'prompts', `${id}.md`); },
    getSettingsPath() { return path.join('.github', 'settings.json'); },
    formatAgent(d, m) {
        return `---\nname: ${e(d.name)}\ndescription: ${e(d.description)}\nmodel: ${m}\n---\n\n${d.body}\n`;
    },
    formatSkill(d, _m) {
        return `---\nname: ${e(d.name)}\ndescription: ${e(d.description)}\n${d.argumentHint ? `argument-hint: ${d.argumentHint}\n` : ''}---\n\n${d.body}\n`;
    },
    formatSettings() { return '{}\n'; },
    getDefaultModels: () => buildDefaultModels({
        'DeepSeek-*': 'gpt-4o',
        'Kimi-*': 'gpt-4o',
        'GLM-*': 'gpt-4o-mini',
        'MiniMax-*': 'gpt-4o-mini',
    }, 'gpt-4o'),
};
//# sourceMappingURL=github-copilot.js.map