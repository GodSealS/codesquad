/**
 * backup-core — Local backup & restore for agents/ and skills/
 *
 * Phase 7.3: Creates timestamped snapshots of agent/skill definitions.
 * Protects user customizations from being overwritten by updates.
 */
export interface BackupEntry {
    id: string;
    timestamp: string;
    path: string;
    agentCount: number;
    skillCount: number;
}
export interface BackupListResult {
    backups: BackupEntry[];
}
/**
 * Create a backup of agents/ and skills/ directories.
 */
export declare function createBackup(): BackupEntry;
/**
 * List all backups.
 */
export declare function listBackups(): BackupListResult;
/**
 * Restore a backup by ID.
 * Restores to ~/.codesquad/backups/restore-target/ instead of directly
 * overwriting AICore content.
 */
export declare function restoreBackup(backupId: string): BackupEntry | null;
//# sourceMappingURL=backup-core.d.ts.map