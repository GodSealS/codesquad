/**
 * Config Command
 *
 * codesquad config show | set <path> <model> | reset
 * Manages model configuration (models.config.yaml).
 */
import chalk from 'chalk';
import { parse as parseYaml } from 'yaml';
import { logger } from '../utils/logger.js';
/** Legal fields on ApiEndpoint that can be set via config set api.source.<name>.<field> */
const API_ENDPOINT_FIELDS = new Set(['provider', 'baseUrl', 'apiKey', 'headers']);
/** Try to parse a ModelOverride value from a CLI string argument */
function parseModelOverride(raw) {
    // Plain string
    if (!raw.startsWith('{'))
        return raw;
    // Try JSON first ({"model":"x","source":"y"})
    try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object' && typeof obj.model === 'string' && typeof obj.source === 'string') {
            return { model: obj.model, source: obj.source };
        }
    }
    catch { /* not JSON */ }
    // Try YAML-style ({model: x, source: y}) — handles quoted values and special chars
    try {
        const parsed = parseYaml(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const obj = parsed;
            if (typeof obj.model === 'string' && typeof obj.source === 'string') {
                return { model: obj.model, source: obj.source };
            }
        }
    }
    catch { /* not YAML */ }
    return null;
}
/** Format a ModelOverride value for display (handles both string and object forms) */
function formatModelValue(v) {
    return typeof v === 'string' ? v : `${v.model} (source: ${v.source})`;
}
export async function handleConfig(action, _opts, cmd) {
    const config = await import('../core/models.js');
    const projectPath = process.cwd();
    switch (action) {
        case 'show': {
            const mc = config.loadModelsConfig(projectPath);
            const hasContent = (Object.keys(mc.agents ?? {}).length > 0)
                || (Object.keys(mc.skills ?? {}).length > 0)
                || (Object.keys(mc.batch ?? {}).length > 0)
                || mc.default !== null
                || (mc.api?.sources && Object.keys(mc.api.sources).length > 0);
            if (!hasContent) {
                console.log(chalk.dim('No model overrides configured. Use `codesquad config set ...` or `codesquad config import <file>` to add.'));
            }
            else {
                console.log(chalk.bold('Model Configuration:'));
                if (Object.keys(mc.agents ?? {}).length > 0) {
                    console.log(chalk.cyan('  Agents:'));
                    for (const [k, v] of Object.entries(mc.agents ?? {})) {
                        console.log(`    ${k}: ${chalk.green(formatModelValue(v))}`);
                    }
                }
                if (Object.keys(mc.skills ?? {}).length > 0) {
                    console.log(chalk.cyan('  Skills:'));
                    for (const [k, v] of Object.entries(mc.skills ?? {})) {
                        console.log(`    ${k}: ${chalk.green(formatModelValue(v))}`);
                    }
                }
                if (Object.keys(mc.batch ?? {}).length > 0) {
                    console.log(chalk.cyan('  Batch:'));
                    for (const [k, v] of Object.entries(mc.batch ?? {})) {
                        console.log(`    "${k}" → ${chalk.green(v)}`);
                    }
                }
                if (mc.default !== null) {
                    console.log(chalk.cyan(`  Default: ${chalk.green(mc.default)}`));
                }
                if (mc.api?.sources && Object.keys(mc.api.sources).length > 0) {
                    console.log(chalk.cyan('  API Sources:'));
                    for (const [name, ep] of Object.entries(mc.api.sources)) {
                        console.log(`    ${chalk.bold(name)}:`);
                        if (ep.provider)
                            console.log(`      provider: ${chalk.green(ep.provider)}`);
                        if (ep.baseUrl)
                            console.log(`      baseUrl:  ${chalk.green(ep.baseUrl)}`);
                        if (ep.apiKey)
                            console.log(`      apiKey:   ${chalk.dim('(set)')}`);
                        if (ep.headers && Object.keys(ep.headers).length > 0) {
                            console.log(`      headers:  ${chalk.dim(JSON.stringify(ep.headers))}`);
                        }
                    }
                }
            }
            break;
        }
        case 'import': {
            const args = cmd.args.slice(1);
            if (args.length < 1 || args[0] === undefined) {
                console.log(chalk.yellow('Usage: codesquad config import <file>'));
                console.log(chalk.dim('  Import a YAML model config file and merge into models.config.yaml'));
                break;
            }
            const importFile = args[0];
            try {
                const { added, warnings } = config.importModelsConfig(projectPath, importFile);
                logger.success(`Imported ${added} entries from ${importFile}`);
                for (const w of warnings) {
                    console.log(chalk.yellow(`  ⚠ ${w}`));
                }
            }
            catch (e) {
                console.log(chalk.red(`Import failed: ${e instanceof Error ? e.message : String(e)}`));
            }
            break;
        }
        case 'template': {
            const args = cmd.args.slice(1);
            const force = args.includes('--force');
            const written = config.writeModelsConfigTemplate(projectPath, force);
            if (written) {
                logger.success('Created models.config.yaml with annotated template');
                console.log(chalk.dim('  Edit the file to set your preferred models, then run:'));
                console.log(chalk.dim('    codesquad config show            # verify'));
                console.log(chalk.dim('    codesquad config import <file>   # batch import'));
            }
            else {
                console.log(chalk.yellow('models.config.yaml already exists. Use --force to overwrite.'));
            }
            break;
        }
        case 'reset': {
            config.resetModelsConfig(projectPath);
            logger.success('Models config reset to defaults.');
            break;
        }
        case 'set': {
            const args = cmd.args.slice(1);
            if (args.length < 2) {
                console.log(chalk.yellow('Usage: codesquad config set <path> <model>'));
                console.log(chalk.dim('  codesquad config set agent.game-designer "claude-sonnet"'));
                console.log(chalk.dim('  codesquad config set batch.Kimi-* "claude-sonnet"'));
                console.log(chalk.dim('  codesquad config set default "claude-haiku"'));
                break;
            }
            const [pathStr, ...modelParts] = args;
            if (!pathStr) {
                console.log(chalk.yellow('Missing path argument.'));
                break;
            }
            const model = modelParts.join(' ').replace(/^"|"$/g, '');
            if (pathStr === 'default') {
                config.setDefaultModel(projectPath, model);
                logger.success(`Default model set to: ${model}`);
            }
            else if (pathStr.startsWith('agent.')) {
                const agentName = pathStr.slice(6);
                const override = parseModelOverride(model);
                if (override === null) {
                    console.log(chalk.yellow(`Invalid ModelOverride: ${model}. Use a string or {model: x, source: y}`));
                    break;
                }
                config.setAgentModel(projectPath, agentName, override);
                logger.success(`Agent ${agentName} → ${typeof override === 'string' ? override : `${override.model} (source: ${override.source})`}`);
            }
            else if (pathStr.startsWith('skill.')) {
                const skillName = pathStr.slice(6);
                const override = parseModelOverride(model);
                if (override === null) {
                    console.log(chalk.yellow(`Invalid ModelOverride: ${model}. Use a string or {model: x, source: y}`));
                    break;
                }
                config.setSkillModel(projectPath, skillName, override);
                logger.success(`Skill ${skillName} → ${typeof override === 'string' ? override : `${override.model} (source: ${override.source})`}`);
            }
            else if (pathStr.startsWith('api.source.')) {
                const remainder = pathStr.slice(11);
                const dotIdx = remainder.indexOf('.');
                if (dotIdx < 0) {
                    console.log(chalk.yellow(`Invalid api.source path: ${pathStr} (expected api.source.<name>.<field>)`));
                    break;
                }
                const sourceName = remainder.slice(0, dotIdx);
                const fieldName = remainder.slice(dotIdx + 1);
                // Validate field name
                if (!API_ENDPOINT_FIELDS.has(fieldName)) {
                    console.log(chalk.yellow(`Invalid field '${fieldName}'. Valid fields: ${[...API_ENDPOINT_FIELDS].join(', ')}`));
                    break;
                }
                if (model === '') {
                    if (fieldName === 'headers') {
                        config.setApiSourceHeaders(projectPath, sourceName, {});
                        logger.success(`API source '${sourceName}' headers cleared`);
                    }
                    else {
                        config.setApiSourceField(projectPath, sourceName, fieldName, undefined);
                        logger.success(`API source '${sourceName}' field '${fieldName}' removed`);
                    }
                }
                else if (fieldName === 'headers') {
                    // Parse headers value as JSON object
                    try {
                        const headersObj = JSON.parse(model);
                        if (typeof headersObj !== 'object' || Array.isArray(headersObj))
                            throw new Error('Not an object');
                        config.setApiSourceHeaders(projectPath, sourceName, headersObj);
                        logger.success(`API source '${sourceName}' headers → ${JSON.stringify(headersObj)}`);
                    }
                    catch {
                        console.log(chalk.yellow(`Invalid headers JSON: ${model}. Expected a JSON object like {"X-Key":"val"}`));
                        break;
                    }
                }
                else {
                    config.setApiSourceField(projectPath, sourceName, fieldName, model);
                    logger.success(`API source '${sourceName}' field '${fieldName}' → ${model}`);
                }
            }
            else if (pathStr.startsWith('batch.')) {
                const pattern = pathStr.slice(6).replace(/^"|"$/g, '');
                config.setBatchMapping(projectPath, pattern, model);
                logger.success(`Batch "${pattern}" → ${model}`);
            }
            else {
                console.log(chalk.red(`Unknown path: ${pathStr}`));
            }
            break;
        }
        default:
            console.log(chalk.yellow(`Unknown action: ${action}. Use show, set, or reset.`));
    }
}
//# sourceMappingURL=config.js.map