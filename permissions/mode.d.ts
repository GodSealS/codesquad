/**
 * Permission mode definitions — aligned with Claude Code PermissionMode.
 *
 * Phase 2.0
 */
export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk';
export declare const ALL_PERMISSION_MODES: PermissionMode[];
/** Legacy CodeSquad ChatMode → PermissionMode mapping. */
export type ChatMode = 'ask' | 'craft' | 'plan';
export declare function chatModeToPermissionMode(cm: ChatMode): PermissionMode;
export declare function permissionModeToChatMode(pm: PermissionMode): ChatMode;
export interface ModeConfig {
    title: string;
    shortTitle: string;
    symbol: string;
    description: string;
}
export declare const PERMISSION_MODE_CONFIG: Record<PermissionMode, ModeConfig>;
/** Progressive trust escalation order (external user cycle). */
export declare const PERMISSION_MODE_CYCLE: PermissionMode[];
export declare function getNextPermissionMode(current: PermissionMode): PermissionMode;
//# sourceMappingURL=mode.d.ts.map