/**
 * CodeSquad Core Configuration
 *
 * Central constants: supported AI tools list, default paths, and config markers.
 * Pattern: mirrors OpenSpec's config.ts for tool interoperability.
 */
export const CODESQUAD_DIR_NAME = '.codesquad';
export const CODESQUAD_MARKERS = {
    start: '<!-- CODESQUAD:START -->',
    end: '<!-- CODESQUAD:END -->',
};
/** All supported AI tools with their directory conventions */
export const AI_TOOLS = [
    { name: 'Amazon Q Developer', value: 'amazon-q', available: true, successLabel: 'Amazon Q Developer', skillsDir: '.amazonq' },
    { name: 'Antigravity', value: 'antigravity', available: true, successLabel: 'Antigravity', skillsDir: '.agent' },
    { name: 'Auggie (Augment CLI)', value: 'auggie', available: true, successLabel: 'Auggie', skillsDir: '.augment' },
    { name: 'Bob Shell', value: 'bob', available: true, successLabel: 'Bob Shell', skillsDir: '.bob' },
    { name: 'Claude Code', value: 'claude', available: true, successLabel: 'Claude Code', skillsDir: '.claude' },
    { name: 'Cline', value: 'cline', available: true, successLabel: 'Cline', skillsDir: '.cline' },
    { name: 'Codex', value: 'codex', available: true, successLabel: 'Codex', skillsDir: '.codex' },
    { name: 'ForgeCode', value: 'forgecode', available: true, successLabel: 'ForgeCode', skillsDir: '.forge' },
    { name: 'CodeBuddy Code (CLI)', value: 'codebuddy', available: true, successLabel: 'CodeBuddy Code', skillsDir: '.codebuddy' },
    { name: 'Continue', value: 'continue', available: true, successLabel: 'Continue (VS Code / JetBrains)', skillsDir: '.continue' },
    { name: 'CoStrict', value: 'costrict', available: true, successLabel: 'CoStrict', skillsDir: '.cospec' },
    { name: 'Crush', value: 'crush', available: true, successLabel: 'Crush', skillsDir: '.crush' },
    { name: 'Cursor', value: 'cursor', available: true, successLabel: 'Cursor', skillsDir: '.cursor' },
    { name: 'Factory Droid', value: 'factory', available: true, successLabel: 'Factory Droid', skillsDir: '.factory' },
    { name: 'Gemini CLI', value: 'gemini', available: true, successLabel: 'Gemini CLI', skillsDir: '.gemini' },
    { name: 'GitHub Copilot', value: 'github-copilot', available: true, successLabel: 'GitHub Copilot', skillsDir: '.github', detectionPaths: ['.github/copilot-instructions.md', '.github/prompts'] },
    { name: 'iFlow', value: 'iflow', available: true, successLabel: 'iFlow', skillsDir: '.iflow' },
    { name: 'Junie', value: 'junie', available: true, successLabel: 'Junie', skillsDir: '.junie' },
    { name: 'Kilo Code', value: 'kilocode', available: true, successLabel: 'Kilo Code', skillsDir: '.kilocode' },
    { name: 'Kimi CLI', value: 'kimi', available: true, successLabel: 'Kimi CLI', skillsDir: '.kimi' },
    { name: 'Kiro', value: 'kiro', available: true, successLabel: 'Kiro', skillsDir: '.kiro' },
    { name: 'Lingma', value: 'lingma', available: true, successLabel: 'Lingma', skillsDir: '.lingma' },
    { name: 'Mistral Vibe', value: 'vibe', available: true, successLabel: 'Mistral Vibe', skillsDir: '.vibe' },
    { name: 'OpenCode', value: 'opencode', available: true, successLabel: 'OpenCode', skillsDir: '.opencode' },
    { name: 'Pi', value: 'pi', available: true, successLabel: 'Pi', skillsDir: '.pi' },
    { name: 'Qoder', value: 'qoder', available: true, successLabel: 'Qoder', skillsDir: '.qoder' },
    { name: 'Qwen Code', value: 'qwen', available: true, successLabel: 'Qwen Code', skillsDir: '.qwen' },
    { name: 'RooCode', value: 'roocode', available: true, successLabel: 'RooCode', skillsDir: '.roo' },
    { name: 'Trae', value: 'trae', available: true, successLabel: 'Trae', skillsDir: '.trae' },
    { name: 'Windsurf', value: 'windsurf', available: true, successLabel: 'Windsurf', skillsDir: '.windsurf' },
    { name: 'AGENTS.md (Amp, VS Code, ...)', value: 'agents', available: false, successLabel: 'your AGENTS.md-compatible assistant' },
];
/** Look up a tool by its value ID */
export function getToolByValue(value) {
    return AI_TOOLS.find((t) => t.value === value);
}
/** Get tool-specific skills directory */
export function getToolDir(toolValue) {
    const tool = getToolByValue(toolValue);
    return tool?.skillsDir ?? `.${toolValue}`;
}
//# sourceMappingURL=config.js.map