// Windsurf adapter
import path from 'path';
import { buildDefaultModels } from './types.js';
export const windsurfAdapter = {
    toolId: 'windsurf',
    getAgentPath(id) { return path.join('.windsurf', 'agents', `${id}.md`); },
    getSkillPath(id) { return path.join('.windsurf', 'workflows', `${id}.md`); },
    getSettingsPath() { return path.join('.windsurf', 'settings.json'); },
    formatAgent(d, m) {
        return `---\nname: ${d.name}\ndescription: ${d.description}\nmodel: ${m}\n---\n\n${d.body}\n`;
    },
    formatSkill(d, m) {
        return `---\nname: ${d.name}\ndescription: ${d.description}\n${d.argumentHint ? `argument-hint: ${d.argumentHint}\n` : ''}---\n\n${d.body}\n`;
    },
    formatSettings() { return '{}'; },
    getDefaultModels: () => buildDefaultModels({
        'DeepSeek-*': 'claude-sonnet-4-20250514',
        'Kimi-*': 'gpt-4o',
        'GLM-*': 'gpt-4o-mini',
        'MiniMax-*': 'gpt-4o-mini',
    }, 'claude-sonnet-4-20250514'),
};
//# sourceMappingURL=windsurf.js.map