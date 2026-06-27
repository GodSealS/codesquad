/**
 * User settings management.
 *
 * Stores persistent user preferences in ~/.codesquad/config.json.
 * Phase 8.1: Cross-chat memory limit configuration.
 */
export interface UserSettings {
    memoryLimitChats: number;
    /** Whether the user has accepted the Craft (bypass) confirmation dialog. */
    hasCraftConfirmed: boolean;
    /** Whether streaming output is enabled (P3.1). */
    streamingEnabled: boolean;
}
/** Load user settings, merging with defaults for missing fields. */
export declare function loadSettings(): UserSettings;
/** Save a partial update, validate ranges, and persist to disk. */
export declare function saveSettings(partial: Partial<UserSettings>): UserSettings;
/** Shortcut to get the current memory limit. */
export declare function getMemoryLimit(): number;
//# sourceMappingURL=settings.d.ts.map