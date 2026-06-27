/**
 * Sandbox mode — restricts BashTool commands based on settings.json sandbox config.
 *
 * References:
 *   Claude Code @anthropic-ai/sandbox-runtime (simplified)
 *
 * Phase 2.5
 */
export interface SandboxConfig {
    enabled: boolean;
    autoAllowBashIfSandboxed: boolean;
    excludedCommands: string[];
}
/** Load sandbox configuration (from settings.json). */
export declare function loadSandboxConfig(config: Partial<SandboxConfig>): void;
/** Check if sandbox mode is enabled. */
export declare function isSandboxEnabled(): boolean;
/** Check if a Bash command is allowed in sandbox mode. */
export declare function isCommandAllowedInSandbox(command: string): boolean;
/** Get excluded commands list (for display). */
export declare function getExcludedCommands(): string[];
/** Get the full sandbox config. */
export declare function getSandboxConfig(): Readonly<SandboxConfig>;
/** Reset to defaults. */
export declare function resetSandboxConfig(): void;
//# sourceMappingURL=sandbox.d.ts.map