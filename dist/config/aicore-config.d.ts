/**
 * .codesquad config loader — loads .codesquad/settings.json into the permission pipeline.
 *
 * References:
 *   Claude Code src/Config/ (config loading)
 *
 * Phase 5.5 — Chat Feature Gap Fill
 */
/**
 * Load and apply all .codesquad settings from settings.json.
 *
 * Handles:
 *   - permissions.allow[] / deny[] / ask[] → registered as permission rules
 *   - sandbox.* → applied to sandbox config
 *
 * @param codesquadDir - Path to the .codesquad directory
 * @returns true if settings.json was loaded, false if not found
 */
export declare function loadCodesquadConfig(codesquadDir: string): boolean;
//# sourceMappingURL=aicore-config.d.ts.map