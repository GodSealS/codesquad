/**
 * Sandbox mode — restricts BashTool commands based on settings.json sandbox config.
 *
 * References:
 *   Claude Code @anthropic-ai/sandbox-runtime (simplified)
 *
 * Phase 2.5
 */
// ── Defaults ──
const DEFAULT_SANDBOX_CONFIG = {
    enabled: false,
    autoAllowBashIfSandboxed: false,
    excludedCommands: ['git', 'docker', 'rm', 'curl', 'wget'],
};
let _sandboxConfig = { ...DEFAULT_SANDBOX_CONFIG };
// ── API ──
/** Load sandbox configuration (from settings.json). */
export function loadSandboxConfig(config) {
    _sandboxConfig = {
        enabled: config.enabled ?? DEFAULT_SANDBOX_CONFIG.enabled,
        autoAllowBashIfSandboxed: config.autoAllowBashIfSandboxed ?? DEFAULT_SANDBOX_CONFIG.autoAllowBashIfSandboxed,
        excludedCommands: config.excludedCommands ?? DEFAULT_SANDBOX_CONFIG.excludedCommands,
    };
}
/** Check if sandbox mode is enabled. */
export function isSandboxEnabled() {
    return _sandboxConfig.enabled;
}
/** Check if a Bash command is allowed in sandbox mode. */
export function isCommandAllowedInSandbox(command) {
    if (!_sandboxConfig.enabled)
        return true;
    const trimmed = command.trim().toLowerCase();
    for (const excluded of _sandboxConfig.excludedCommands) {
        if (trimmed.startsWith(excluded.toLowerCase() + ' ') || trimmed === excluded.toLowerCase()) {
            return false;
        }
    }
    return true;
}
/** Get excluded commands list (for display). */
export function getExcludedCommands() {
    return _sandboxConfig.excludedCommands;
}
/** Get the full sandbox config. */
export function getSandboxConfig() {
    return _sandboxConfig;
}
/** Reset to defaults. */
export function resetSandboxConfig() {
    _sandboxConfig = { ...DEFAULT_SANDBOX_CONFIG };
}
//# sourceMappingURL=sandbox.js.map