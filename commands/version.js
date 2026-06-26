/**
 * Version Command
 *
 * codesquad version — Display version info and check for updates.
 * Phase 7.1: CLI entry point for version checks.
 */
import chalk from 'chalk';
import { getVersionInfo, checkLatestVersion } from '../core/version-core.js';
export async function handleVersion(options) {
    const info = getVersionInfo();
    if (options.json) {
        console.log(JSON.stringify(info, null, 2));
        return;
    }
    console.log(chalk.bold(`\nCodeSquad CLI v${info.cliVersion}`));
    console.log(`├── ${chalk.cyan('Agents')}:    ${info.agentCount}`);
    console.log(`├── ${chalk.cyan('Skills')}:    ${info.skillCount}`);
    console.log(`├── ${chalk.cyan('Templates')}: ${info.templateCount}`);
    console.log(`└── ${chalk.dim('Node')}:      ${info.nodeVersion}`);
    if (options.check) {
        console.log(chalk.dim('\n  Checking npm registry for updates...'));
        const result = await checkLatestVersion();
        if (result.error) {
            console.log(chalk.yellow(`  Could not check for updates: ${result.error}`));
        }
        else if (result.updateAvailable) {
            console.log(chalk.green(`\n  New version available: ${chalk.bold('v' + result.latest)} → Run ${chalk.cyan('npm update -g codesquad')}`));
        }
        else {
            console.log(chalk.dim('\n  Already up to date.'));
        }
    }
    console.log('');
}
//# sourceMappingURL=version.js.map