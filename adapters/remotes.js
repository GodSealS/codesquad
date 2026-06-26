/**
 * Remote/Lightweight Adapters — batch template for tools with similar frontmatter.
 * Each adapter follows the pattern: {toolId}/agents/{id}.md, {toolId}/commands/{id}.md
 */
import path from 'path';
import { buildDefaultModels } from './types.js';
function makeAdapter(toolId, skillDir, cmdDir, defaultModels) {
    return {
        toolId,
        getAgentPath(id) { return path.join(skillDir, 'agents', `${id}.md`); },
        getSkillPath(id) { return path.join(skillDir, cmdDir, `${id}.md`); },
        getSettingsPath() { return path.join(skillDir, 'settings.json'); },
        formatAgent(d, m) {
            return `---\nname: ${d.name}\ndescription: "${d.description.replace(/"/g, '\\"')}"\nmodel: ${m}\n---\n\n${d.body}\n`;
        },
        formatSkill(d, _m) {
            return `---\nname: ${d.name}\ndescription: "${d.description.replace(/"/g, '\\"')}"\n${d.argumentHint ? `argument-hint: ${d.argumentHint}\n` : ''}---\n\n${d.body}\n`;
        },
        formatSettings() { return '{}'; },
        getDefaultModels: () => defaultModels ?? {},
    };
}
export const amazonQAdapter = makeAdapter('amazon-q', '.amazonq', 'commands');
export const antigravityAdapter = makeAdapter('antigravity', '.agent', 'commands');
export const auggieAdapter = makeAdapter('auggie', '.augment', 'commands');
export const bobAdapter = makeAdapter('bob', '.bob', 'commands');
export const clineAdapter = makeAdapter('cline', '.cline', 'commands');
export const continueAdapter = makeAdapter('continue', '.continue', 'commands');
export const costrictAdapter = makeAdapter('costrict', '.cospec', 'commands');
export const crushAdapter = makeAdapter('crush', '.crush', 'commands');
export const factoryAdapter = makeAdapter('factory', '.factory', 'commands');
export const forgecodeAdapter = makeAdapter('forgecode', '.forge', 'commands');
export const iflowAdapter = makeAdapter('iflow', '.iflow', 'commands');
export const junieAdapter = makeAdapter('junie', '.junie', 'commands');
export const kilocodeAdapter = makeAdapter('kilocode', '.kilocode', 'commands');
export const kimiAdapter = makeAdapter('kimi', '.kimi', 'commands', buildDefaultModels({ 'Kimi-*': 'kimi-k2.6' }));
export const kiroAdapter = makeAdapter('kiro', '.kiro', 'commands');
export const lingmaAdapter = makeAdapter('lingma', '.lingma', 'commands');
export const opencodeAdapter = makeAdapter('opencode', '.opencode', 'commands');
export const piAdapter = makeAdapter('pi', '.pi', 'commands');
export const qoderAdapter = makeAdapter('qoder', '.qoder', 'commands');
export const qwenAdapter = makeAdapter('qwen', '.qwen', 'commands', buildDefaultModels({ 'DeepSeek-*': 'qwen-max', 'GLM-*': 'qwen-plus' }));
export const roocodeAdapter = makeAdapter('roocode', '.roo', 'commands');
export const traeAdapter = makeAdapter('trae', '.trae', 'commands');
export const vibeAdapter = makeAdapter('vibe', '.vibe', 'commands');
//# sourceMappingURL=remotes.js.map