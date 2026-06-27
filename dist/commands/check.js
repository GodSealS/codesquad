/**
 * Check Command
 *
 * codesquad check — Validate local definition integrity.
 * Phase 7.2: CLI entry point for integrity checks.
 */
import chalk from 'chalk';
import { runCheck } from '../core/check-core.js';
import { handleCheckStubs } from './check-stubs.js';
export async function handleCheck(options) {
    if (options.stubs) {
        await handleCheckStubs('stubs');
        return;
    }
    const onlyAgents = options.agents === true;
    const onlySkills = options.skills === true;
    const scope = onlyAgents ? 'agents' : onlySkills ? 'skills' : 'agents + skills';
    console.log(chalk.cyan(`\nChecking ${scope}...`));
    const result = runCheck({
        agents: onlyAgents || (!onlyAgents && !onlySkills) ? true : undefined,
        skills: onlySkills || (!onlyAgents && !onlySkills) ? true : undefined,
    });
    const errors = result.issues.filter((i) => i.type === 'error');
    const warnings = result.issues.filter((i) => i.type === 'warning');
    if (result.issues.length === 0) {
        console.log(chalk.green(`\n✔ All checks passed. ${result.agentCount} agents, ${result.skillCount} skills.\n`));
        return;
    }
    // Print errors
    if (errors.length > 0) {
        console.log(chalk.red(`\n✗ ${errors.length} error(s):`));
        for (const issue of errors) {
            console.log(`  ${chalk.red('✗')} ${chalk.bold(issue.file)}: ${issue.message}`);
        }
    }
    // Print warnings
    if (warnings.length > 0) {
        console.log(chalk.yellow(`\n⚠ ${warnings.length} warning(s):`));
        for (const issue of warnings) {
            console.log(`  ${chalk.yellow('⚠')} ${chalk.dim(issue.file)}: ${issue.message}`);
        }
    }
    // Summary
    const statusIcon = result.ok ? chalk.green('✔') : chalk.red('✗');
    console.log(`\n${statusIcon} ${result.agentCount} agents, ${result.skillCount} skills — ${errors.length} error(s), ${warnings.length} warning(s)\n`);
}
//# sourceMappingURL=check.js.map