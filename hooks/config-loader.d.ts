/**
 * Hook configuration loader — reads hooks from two layers.
 *
 * Layers: Project (.codesquad/) > User (AICore/)
 *
 * Phase 2.4
 */
import type { HooksSettings } from './types.js';
/**
 * Load hooks configuration from AICore/settings.json.
 * Returns the parsed HooksSettings, or null if not found.
 */
export declare function loadHooksFromAICore(aicoreDir: string): HooksSettings | null;
/**
 * Load hooks configuration from layered settings.json files.
 * Merges: AICore/settings.json → .codesquad/settings.json
 * Later layers override earlier ones for matching events.
 */
export declare function loadHooksFromLayered(aicoreDir: string, cwd?: string): HooksSettings;
/**
 * Initialize hooks system from AICore configuration.
 * Call once at REPL startup.
 * Now supports layered loading (AICore + User + Project).
 */
export declare function initHooksFromAICore(aicoreDir: string, cwd?: string): void;
//# sourceMappingURL=config-loader.d.ts.map