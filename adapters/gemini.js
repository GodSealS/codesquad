// Gemini CLI adapter
import path from 'path';
import { buildDefaultModels } from './types.js';
export const geminiAdapter = {
    toolId: 'gemini',
    getAgentPath(id) { return path.join('.gemini', 'agents', `${id}.md`); },
    getSkillPath(id) { return path.join('.gemini', 'commands', `${id}.md`); },
    getSettingsPath() { return path.join('.gemini', 'settings.json'); },
    formatAgent(d, m) {
        return `---\nname: ${d.name}\ndescription: "${d.description.replace(/"/g, '\\"')}"\nmodel: ${m}\n---\n\n${d.body}\n`;
    },
    formatSkill(d, m) {
        return `---\nname: ${d.name}\ndescription: "${d.description.replace(/"/g, '\\"')}"\n${d.argumentHint ? `argument-hint: ${d.argumentHint}\n` : ''}---\n\n${d.body}\n`;
    },
    formatSettings() { return '{}'; },
    getDefaultModels: () => buildDefaultModels({
        'DeepSeek-*': 'gemini-2.5-flash',
        'Kimi-*': 'gemini-2.5-flash',
        'GLM-*': 'gemini-2.5-flash-8b',
        'MiniMax-*': 'gemini-2.5-flash-8b',
    }, 'gemini-2.5-flash'),
};
//# sourceMappingURL=gemini.js.map