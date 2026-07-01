/**
 * User settings management.
 *
 * Stores persistent user preferences in ~/.codesquad/config.json.
 * Phase 8.1: Cross-chat memory limit configuration.
 */
import type { SemanticContextConfig } from '../embedding/types.js';
export interface UserSettings {
    memoryLimitChats: number;
    /** Whether the user has accepted the Craft (bypass) confirmation dialog. */
    hasCraftConfirmed: boolean;
    /** Whether streaming output is enabled (P3.1). */
    streamingEnabled: boolean;
    /** 语义上下文检索配置 */
    semanticContext: SemanticContextConfig;
}
/** Load user settings, merging with defaults for missing fields. */
export declare function loadSettings(): UserSettings;
/** Save a partial update, validate ranges, and persist to disk. */
export declare function saveSettings(partial: Partial<UserSettings>): UserSettings;
/** Shortcut to get the current memory limit. */
export declare function getMemoryLimit(): number;
//# sourceMappingURL=settings.d.ts.map