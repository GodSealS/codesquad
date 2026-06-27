/**
 * Adapter Registry
 *
 * Central registry of all AI tool adapters (25+ tools).
 * To add a new tool: create its adapter, import it here, and add to the map.
 */
import { codebuddyAdapter } from './codebuddy.js';
import { claudeAdapter } from './claude.js';
import { codexAdapter } from './codex.js';
import { cursorAdapter } from './cursor.js';
import { geminiAdapter } from './gemini.js';
import { windsurfAdapter } from './windsurf.js';
import { githubCopilotAdapter } from './github-copilot.js';
import { amazonQAdapter, antigravityAdapter, auggieAdapter, bobAdapter, clineAdapter, continueAdapter, costrictAdapter, crushAdapter, factoryAdapter, forgecodeAdapter, iflowAdapter, junieAdapter, kilocodeAdapter, kimiAdapter, kiroAdapter, lingmaAdapter, opencodeAdapter, piAdapter, qoderAdapter, qwenAdapter, roocodeAdapter, traeAdapter, vibeAdapter, } from './remotes.js';
/** Map of tool value ID → adapter instance */
export const adapterMap = new Map([
    codebuddyAdapter, claudeAdapter, codexAdapter,
    cursorAdapter, geminiAdapter, windsurfAdapter, githubCopilotAdapter,
    amazonQAdapter, antigravityAdapter, auggieAdapter, bobAdapter,
    clineAdapter, continueAdapter, costrictAdapter, crushAdapter,
    factoryAdapter, forgecodeAdapter, iflowAdapter, junieAdapter,
    kilocodeAdapter, kimiAdapter, kiroAdapter, lingmaAdapter,
    opencodeAdapter, piAdapter, qoderAdapter, qwenAdapter,
    roocodeAdapter, traeAdapter, vibeAdapter,
].map((a) => [a.toolId, a]));
/** Get adapter for a given tool value */
export function getAdapter(toolValue) {
    return adapterMap.get(toolValue);
}
/** List all available adapter tool IDs */
export function getAvailableAdapters() {
    return Array.from(adapterMap.keys());
}
//# sourceMappingURL=index.js.map