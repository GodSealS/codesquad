/**
 * Settings Generator
 *
 * Generates tool-specific settings files (e.g., AICore/settings.json for CodeBuddy)
 * from the canonical Agent and Skill definitions.
 */
export interface SettingsGenerateOptions {
    /** Target project directory */
    targetPath: string;
    /** Specific tools (if empty, generates for all bound tools) */
    tools?: string[];
}
/**
 * Generate settings files for bound (or specified) tools.
 */
export declare function generateSettings(options: SettingsGenerateOptions): Promise<{
    count: number;
    errors: string[];
}>;
/** Print a summary of settings generation */
export declare function printSettingsSummary(result: {
    count: number;
    errors: string[];
}): void;
//# sourceMappingURL=settings-generator.d.ts.map