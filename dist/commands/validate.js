/**
 * Validate Command
 *
 * codesquad validate — Run static checks and coverage reports.
 * Phase 6.3: CLI entry point for the validate system.
 */
import chalk from 'chalk';
import { validateStaticOne, validateStaticAll } from '../core/validate-core.js';
import { getCoverageStats, getSkillEntries } from '../core/validate-catalog.js';
import { runCIValidation } from '../core/validate-ci.js';
import { validateProject } from '../core/validate-project.js';
// ── Helpers ────────────────────────────────────────────
function formatCheckIcon(result) {
    switch (result) {
        case 'PASS':
            return chalk.green('✓');
        case 'FAIL':
            return chalk.red('✗');
        case 'WARN':
            return chalk.yellow('⚠');
        default:
            return '?';
    }
}
function formatVerdict(verdict) {
    switch (verdict) {
        case 'COMPLIANT':
            return chalk.green(verdict);
        case 'WARNINGS':
            return chalk.yellow(verdict);
        case 'NON-COMPLIANT':
            return chalk.red(verdict);
        default:
            return verdict;
    }
}
function printStaticResult(result) {
    console.log(chalk.bold(`\n── ${result.skillName} ──`));
    console.log(`  ${formatCheckIcon(result.checks.check1.result)} Check 1: ${result.checks.check1.name} — ${result.checks.check1.result}`);
    if (result.checks.check1.detail) {
        console.log(`    ${chalk.dim(result.checks.check1.detail)}`);
    }
    console.log(`  ${formatCheckIcon(result.checks.check2.result)} Check 2: ${result.checks.check2.name} — ${result.checks.check2.result}`);
    if (result.checks.check2.detail) {
        console.log(`    ${chalk.dim(result.checks.check2.detail)}`);
    }
    console.log(`  ${formatCheckIcon(result.checks.check3.result)} Check 3: ${result.checks.check3.name} — ${result.checks.check3.result}`);
    if (result.checks.check3.detail) {
        console.log(`    ${chalk.dim(result.checks.check3.detail)}`);
    }
    console.log(`  ${formatCheckIcon(result.checks.check4.result)} Check 4: ${result.checks.check4.name} — ${result.checks.check4.result}`);
    if (result.checks.check4.detail) {
        console.log(`    ${chalk.dim(result.checks.check4.detail)}`);
    }
    console.log(`  ${formatCheckIcon(result.checks.check5.result)} Check 5: ${result.checks.check5.name} — ${result.checks.check5.result}`);
    if (result.checks.check5.detail) {
        console.log(`    ${chalk.dim(result.checks.check5.detail)}`);
    }
    console.log(`  ${formatCheckIcon(result.checks.check6.result)} Check 6: ${result.checks.check6.name} — ${result.checks.check6.result}`);
    if (result.checks.check6.detail) {
        console.log(`    ${chalk.dim(result.checks.check6.detail)}`);
    }
    console.log(`  ${formatCheckIcon(result.checks.check7.result)} Check 7: ${result.checks.check7.name} — ${result.checks.check7.result}`);
    if (result.checks.check7.detail) {
        console.log(`    ${chalk.dim(result.checks.check7.detail)}`);
    }
    console.log(`  Verdict: ${formatVerdict(result.verdict)} (${result.totalFails} fails, ${result.totalWarns} warns)`);
}
// ── Subcommand: validate static ────────────────────────
async function handleValidateStatic(name, all) {
    if (all) {
        const skillNames = getSkillEntries().map((s) => s.name);
        console.log(chalk.cyan(`Running static checks on ${skillNames.length} skills...\n`));
        const { results, summary } = await validateStaticAll(skillNames);
        for (const r of results) {
            printStaticResult(r);
        }
        console.log(chalk.bold(`\n${summary}`));
        return;
    }
    if (name) {
        const result = await validateStaticOne(name);
        printStaticResult(result);
        return;
    }
    console.log(chalk.yellow('Usage: codesquad validate static <name> | --all'));
}
// ── Subcommand: validate audit ─────────────────────────
async function handleValidateAudit() {
    const stats = getCoverageStats();
    console.log(chalk.bold('\n── Coverage Report ──'));
    const skillPct = stats.totalSkills > 0 ? ((stats.skillsTested / stats.totalSkills) * 100).toFixed(1) : '0.0';
    const agentPct = stats.totalAgents > 0 ? ((stats.agentsTested / stats.totalAgents) * 100).toFixed(1) : '0.0';
    console.log(`  Skills:  ${stats.skillsTested}/${stats.totalSkills} tested (${skillPct}%)`);
    console.log(`  Agents:  ${stats.agentsTested}/${stats.totalAgents} tested (${agentPct}%)`);
    console.log(`  COMPLIANT: ${chalk.green(stats.skillsCompliant)} | WARNINGS: ${chalk.yellow(stats.skillsWithWarnings)} | NON-COMPLIANT: ${chalk.red(stats.skillsNonCompliant)}`);
    console.log(chalk.bold('\n  By Category:'));
    for (const [cat, data] of Object.entries(stats.byCategory).sort()) {
        const pct = data.total > 0 ? ((data.tested / data.total) * 100).toFixed(0) : '0';
        console.log(`    ${cat.padEnd(16)} ${String(data.tested).padStart(3)}/${String(data.total).padStart(3)}  ${pct}%`);
    }
    console.log(chalk.bold('\n  By Priority:'));
    for (const [pri, data] of Object.entries(stats.byPriority)) {
        const pct = data.total > 0 ? ((data.tested / data.total) * 100).toFixed(0) : '0';
        const color = pri === 'critical' ? chalk.red : pri === 'high' ? chalk.yellow : chalk.dim;
        console.log(`    ${color(pri.padEnd(16))} ${String(data.tested).padStart(3)}/${String(data.total).padStart(3)}  ${pct}%`);
    }
}
// ── Subcommand: validate ci ────────────────────────────
async function handleValidateCI(failOnWarn) {
    const { result, exitCode } = await runCIValidation(failOnWarn);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = exitCode;
}
// ── Subcommand: validate project ───────────────────────
function handleValidateProject(strict) {
    console.log(chalk.cyan('\nRunning project-level validation...'));
    const result = validateProject(strict);
    console.log(chalk.bold('\n── Project Checks ──'));
    for (const check of result.checks) {
        const icon = check.status === 'pass' ? chalk.green('✓') : check.status === 'fail' ? chalk.red('✗') : chalk.yellow('⚠');
        console.log(`  ${icon} ${check.name}`);
        if (check.detail) {
            console.log(`    ${chalk.dim(check.detail)}`);
        }
    }
    console.log(chalk.bold('\n── Skill Static Checks ──'));
    let compliant = 0, warns = 0, fails = 0;
    for (const r of result.agentResults) {
        if (r.verdict === 'COMPLIANT')
            compliant++;
        else if (r.verdict === 'WARNINGS')
            warns++;
        else
            fails++;
    }
    console.log(`  ${chalk.green('✓ COMPLIANT')}: ${compliant}  ${chalk.yellow('⚠ WARNINGS')}: ${warns}  ${chalk.red('✗ NON-COMPLIANT')}: ${fails}`);
    // Show non-compliant details
    if (fails > 0) {
        console.log(chalk.red('\n  Non-compliant skills:'));
        for (const r of result.agentResults) {
            if (r.verdict === 'NON-COMPLIANT') {
                console.log(`    ${chalk.red('✗')} ${r.skillName} (${r.totalFails} fails, ${r.totalWarns} warns)`);
            }
        }
    }
    const status = result.ok ? chalk.green('✔ PASS') : chalk.red('✗ FAIL');
    console.log(`\n  ${status} — ${result.errors} error(s), ${result.warnings} warning(s)\n`);
}
// ── Subcommand: validate category / spec ───────────────
async function handleValidateIdeRedirect(subcommand, name) {
    console.log(chalk.yellow(`\n  codesquad validate ${subcommand} requires AI-powered validation.`));
    console.log(chalk.cyan(`  Please run in your IDE: /skill-test ${subcommand} ${name ?? '<name>'}`));
    console.log(chalk.dim(`  This check evaluates behavioral correctness which cannot be automated statically.\n`));
}
// ── Main handler ───────────────────────────────────────
export async function handleValidate(subcommand, options) {
    switch (subcommand) {
        case 'static':
            await handleValidateStatic(options.name, options.all);
            break;
        case 'audit':
            await handleValidateAudit();
            break;
        case 'ci':
            await handleValidateCI(!!options.failOnWarn);
            break;
        case 'project':
            handleValidateProject(!!options.strict);
            break;
        case 'category':
            await handleValidateIdeRedirect('category', options.name);
            break;
        case 'spec':
            await handleValidateIdeRedirect('spec', options.name);
            break;
        default:
            console.log(chalk.bold('\nCodeSquad Validate — Agent & Skill Quality Checks\n'));
            console.log(`  ${chalk.green('codesquad validate static <name>')}  Run 7 static checks on a skill`);
            console.log(`  ${chalk.green('codesquad validate static --all')}      Run static checks on all skills`);
            console.log(`  ${chalk.green('codesquad validate audit')}             Show coverage report`);
            console.log(`  ${chalk.green('codesquad validate ci')}                CI mode: JSON output + exit code`);
            console.log(`  ${chalk.green('codesquad validate project')}           Full project validation`);
            console.log(`  ${chalk.green('codesquad validate category <name>')}   Run category rubric check (IDE only)`);
            console.log(`  ${chalk.green('codesquad validate spec <name>')}       Run behavioral spec check (IDE only)`);
            console.log('');
    }
}
//# sourceMappingURL=validate.js.map