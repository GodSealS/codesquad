/**
 * Hook configuration loader — reads hooks from two layers.
 *
 * Layers: Project (.codesquad/) > User (.codesquad/)
 *
 * Phase 2.4
 */
import type { HooksSettings } from './types.js';
/**
 * Load hooks configuration from .codesquad/settings.json.
 * Returns the parsed HooksSettings, or null if not found.
 */
export declare function loadHooksFromCodesquad(codesquadDir: string): HooksSettings | null;
/**
 * Load hooks configuration from layered settings.json files.
 * Merges: .codesquad/settings.json → .codesquad/settings.json
 * Later layers override earlier ones for matching events.
 */
export declare function loadHooksFromLayered(aicoreDir: string, cwd?: string): HooksSettings;
/**
 * Initialize hooks system from .codesquad configuration.
 * Call once at REPL startup.
 * Now supports layered loading (.codesquad + User + Project).
 */
export declare function initHooksFromCodesquad(codesquadDir: string, cwd?: string): void;
//# sourceMappingURL=config-loader.d.ts.map