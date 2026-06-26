/**
 * Backup Command
 *
 * codesquad backup / restore — Local backup & restore for agent/skill definitions.
 * Phase 7.3: CLI entry point.
 */
import chalk from 'chalk';
import { createBackup, listBackups, restoreBackup } from '../core/backup-core.js';
export async function handleBackup(action, options) {
    if (action === 'backup') {
        if (options.list) {
            const { backups } = listBackups();
            if (backups.length === 0) {
                console.log(chalk.dim('\n  No backups found.\n'));
                return;
            }
            console.log(chalk.bold(`\n  Backups (${backups.length}):`));
            for (const b of backups) {
                const date = b.timestamp.slice(0, 10);
                const time = b.timestamp.slice(11, 19);
                console.log(`    ${chalk.cyan(b.id)}  ${date} ${time}  ${b.agentCount}A / ${b.skillCount}S`);
            }
            console.log('');
            return;
        }
        console.log(chalk.cyan('\n  Creating backup...'));
        const entry = createBackup();
        console.log(chalk.green(`\n  ✔ Backup created: ${chalk.bold(entry.id)}`));
        console.log(chalk.dim(`    ${entry.agentCount} agents, ${entry.skillCount} skills`));
        console.log(chalk.dim(`    Location: ${entry.path}\n`));
        return;
    }
    if (action === 'restore') {
        const id = options.id ?? (options.latest ? listBackups().backups[0]?.id : undefined);
        if (!id) {
            console.log(chalk.yellow('\n  No backup specified. Use --id <backup-id> or --latest\n'));
            return;
        }
        console.log(chalk.cyan(`\n  Restoring backup: ${id}...`));
        const entry = restoreBackup(id);
        if (!entry) {
            console.log(chalk.red(`\n  ✗ Backup '${id}' not found or corrupted.\n`));
            return;
        }
        console.log(chalk.green(`\n  ✔ Restored from backup: ${chalk.bold(id)}`));
        console.log(chalk.dim(`    ${entry.agentCount} agents, ${entry.skillCount} skills\n`));
        return;
    }
}
//# sourceMappingURL=backup.js.map