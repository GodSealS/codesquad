/**
 * AICore config loader — loads AICore/settings.json into the permission pipeline.
 *
 * References:
 *   Claude Code src/Config/ (config loading)
 *
 * Phase 5.5 — Chat Feature Gap Fill
 */
/**
 * Load and apply all AICore settings from settings.json.
 *
 * Handles:
 *   - permissions.allow[] / deny[] / ask[] → registered as permission rules
 *   - sandbox.* → applied to sandbox config
 *
 * @param aicoreDir - Path to the AICore directory
 * @returns true if settings.json was loaded, false if not found
 */
export declare function loadAICoreConfig(aicoreDir: string): boolean;
//# sourceMappingURL=aicore-config.d.ts.map