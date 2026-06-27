/**
 * Backup Command
 *
 * codesquad backup / restore — Local backup & restore for agent/skill definitions.
 * Phase 7.3: CLI entry point.
 */
export declare function handleBackup(action: 'backup' | 'restore', options: {
    list?: boolean;
    id?: string;
    latest?: boolean;
}): Promise<void>;
//# sourceMappingURL=backup.d.ts.map