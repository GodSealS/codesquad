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
    /** CLI智能增强 — 语义提取/过滤的总开关。关闭时所有语义功能不可用。 */
    cliSmartEnhancement: boolean;
    /** 单次请求最大生成百分比 — 占模型最大上下文的百分比 (30-90)，默认 50。同时控制上下文窗口和生成上限。 */
    maxGenerationPercent: number;
    /** 语义上下文检索配置 */
    semanticContext: SemanticContextConfig;
}
/** Load user settings, merging with defaults for missing fields. */
export declare function loadSettings(): UserSettings;
/** Save a partial update, validate ranges, and persist to disk.
 * @param partial New values to merge
 * @param current  Optional: pre-loaded current settings (avoids double I/O)
 */
export declare function saveSettings(partial: Partial<UserSettings>, current?: UserSettings): UserSettings;
/** Shortcut to get the current memory limit. */
export declare function getMemoryLimit(): number;
//# sourceMappingURL=settings.d.ts.map