/**
 * register command — External CLI registration into AICore/ (user-level).
 *
 * Commands:
 *   codesquad register agent|skill|rule|hook <path> [--source <name>]
 *   codesquad register list [agent|skill|rule|hook]
 *   codesquad register unregister agent|skill|rule|hook <name>
 */
import { existsSync, statSync } from 'fs';
import { resolve, join } from 'path';
import chalk from 'chalk';
import { registerSource, unregisterAgent, unregisterSkill, unregisterRule, unregisterHook, listRegisteredAgents, listRegisteredSkills, listRegisteredRules, listRegisteredHooks, registerAgentFile, registerRuleFile, registerHookFile, } from '../registry/index.js';
import { CODESQUAD_USER_ROOT } from '../core/paths.js';
/** User-level registry root (~/.codesquad/registry/) */
const USER_REGISTRY_ROOT = join(CODESQUAD_USER_ROOT, 'registry');
function parseCategory(input) {
    const valid = ['agent', 'skill', 'rule', 'hook'];
    const singular = input.replace(/s$/, '');
    return valid.includes(singular) ? singular : null;
}
function printResult(result, label) {
    const parts = [];
    if (result.count > 0)
        parts.push(chalk.green(`${result.count} registered`));
    if (result.updated > 0)
        parts.push(chalk.yellow(`${result.updated} updated`));
    if (result.skipped > 0)
        parts.push(chalk.dim(`${result.skipped} skipped`));
    if (parts.length > 0)
        console.log(`  ${label}: ${parts.join(', ')}`);
    for (const err of result.errors)
        console.log(chalk.red(`  ✗ ${err}`));
}
/** Register external content into AICore/ */
function handleRegisterAdd(category, path, source) {
    const absPath = resolve(path);
    if (!existsSync(absPath)) {
        console.log(chalk.red(`\n  ✗ Path not found: ${absPath}\n`));
        return;
    }
    const sourceName = source ?? 'external';
    console.log(chalk.cyan(`\n  Registering ${category} from: ${absPath}\n`));
    let result;
    if (statSync(absPath).isDirectory()) {
        result = registerSource(USER_REGISTRY_ROOT, { name: sourceName, path: absPath, category });
    }
    else {
        const errors = [];
        let count = 0;
        switch (category) {
            case 'agent': {
                const r = registerAgentFile(USER_REGISTRY_ROOT, absPath, sourceName);
                if (typeof r === 'string')
                    errors.push(r);
                else
                    count = 1;
                break;
            }
            case 'skill':
                errors.push('Skills must be registered as directories. Use the directory containing SKILL.md.');
                break;
            case 'rule': {
                const r = registerRuleFile(USER_REGISTRY_ROOT, absPath, sourceName);
                if (typeof r === 'string')
                    errors.push(r);
                else
                    count = 1;
                break;
            }
            case 'hook': {
                const r = registerHookFile(USER_REGISTRY_ROOT, absPath, sourceName);
                if (typeof r === 'string')
                    errors.push(r);
                else
                    count = 1;
                break;
            }
        }
        result = { count, updated: 0, skipped: 0, errors };
    }
    printResult(result, `${category}s`);
    if (result.errors.length === 0 && result.count > 0) {
        console.log(chalk.green(`\n  ✔ Registered ${result.count} ${category}(s) to AICore/\n`));
    }
}
function handleRegisterList(category) {
    const categories = category ? [category] : ['agent', 'skill', 'rule', 'hook'];
    const getters = {
        agent: () => listRegisteredAgents(USER_REGISTRY_ROOT),
        skill: () => listRegisteredSkills(USER_REGISTRY_ROOT),
        rule: () => listRegisteredRules(USER_REGISTRY_ROOT),
        hook: () => listRegisteredHooks(USER_REGISTRY_ROOT),
    };
    for (const cat of categories) {
        const entries = getters[cat]();
        if (entries.length === 0)
            continue;
        console.log(chalk.cyan(`\n  ${cat}s (${entries.length}):`));
        for (const e of entries) {
            const src = e.source === 'aicore' ? chalk.blue('[AICore]')
                : e.source === 'project' ? chalk.magenta('[project]')
                    : chalk.yellow(`[${e.externalSource ?? 'external'}]`);
            console.log(`    ${chalk.white(e.name)}  ${src}`);
        }
    }
    console.log();
}
function handleRegisterUnregister(category, name) {
    const fns = {
        agent: () => unregisterAgent(USER_REGISTRY_ROOT, name),
        skill: () => unregisterSkill(USER_REGISTRY_ROOT, name),
        rule: () => unregisterRule(USER_REGISTRY_ROOT, name),
        hook: () => unregisterHook(USER_REGISTRY_ROOT, name),
    };
    console.log();
    if (fns[category]()) {
        console.log(chalk.green(`  ✔ Unregistered ${category}: ${name} from ~/.codesquad/registry/\n`));
    }
    else {
        console.log(chalk.yellow(`  ⚠ ${category} '${name}' not found in ~/.codesquad/registry/\n`));
    }
}
export async function handleRegister(action, args, options) {
    switch (action) {
        case 'list': {
            const catRaw = args[0] ? parseCategory(args[0]) : null;
            const cat = catRaw ?? undefined;
            if (args[0] && !cat) {
                console.log(chalk.red(`\n  Unknown category: ${args[0]}\n`));
                return;
            }
            handleRegisterList(cat);
            break;
        }
        case 'unregister':
        case 'remove': {
            if (args.length < 2) {
                console.log(chalk.yellow('\n  Usage: codesquad register unregister <agent|skill|rule|hook> <name>\n'));
                return;
            }
            const cat = parseCategory(args[0]);
            if (!cat) {
                console.log(chalk.red(`\n  Unknown category: ${args[0]}\n`));
                return;
            }
            handleRegisterUnregister(cat, args[1]);
            break;
        }
        default: {
            const cat = parseCategory(action);
            if (!cat) {
                console.log(chalk.red(`\n  Unknown action: ${action}\n`));
                console.log(chalk.dim('  Usage: codesquad register <agent|skill|rule|hook> <path> [--source <name>]\n'));
                console.log(chalk.dim('         codesquad register list [category]\n'));
                console.log(chalk.dim('         codesquad register unregister <category> <name>\n'));
                return;
            }
            if (!args[0]) {
                console.log(chalk.yellow(`\n  Usage: codesquad register ${action} <path>\n`));
                return;
            }
            handleRegisterAdd(cat, args[0], options?.source);
            break;
        }
    }
}
//# sourceMappingURL=register.js.map