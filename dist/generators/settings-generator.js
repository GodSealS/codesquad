/**
 * Settings Generator
 *
 * Generates tool-specific settings files (e.g., .codesquad/settings.json for CodeBuddy)
 * from the canonical Agent and Skill definitions.
 */
import { join } from 'path';
import { ensureParentDir } from '../utils/fs.js';
import { getAdapter } from '../adapters/index.js';
import { loadProjectConfig } from '../core/project-config.js';
import { loadAgents } from './agent-generator.js';
import { loadSkills } from './skill-generator.js';
import { logger } from '../utils/logger.js';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { writeFileSync } from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PACKAGE_ROOT = resolve(__dirname, '..', '..');
/**
 * Generate settings files for bound (or specified) tools.
 */
export async function generateSettings(options) {
    const targetPath = resolve(options.targetPath);
    const errors = [];
    // Determine which tools to generate for
    let toolIds;
    if (options.tools && options.tools.length > 0) {
        toolIds = options.tools;
    }
    else {
        const config = loadProjectConfig(targetPath);
        toolIds = config.tools;
        if (config.generation?.skipSettings) {
            logger.info('Settings generation skipped (skipSettings: true in config).');
            return { count: 0, errors: [] };
        }
    }
    // Load canonical definitions from .codesquad/
    const aicoreRoot = join(CLI_PACKAGE_ROOT, '.codesquad');
    const agents = await loadAgents(aicoreRoot);
    const skills = await loadSkills(join(aicoreRoot, 'skills'));
    let count = 0;
    for (const toolId of toolIds) {
        const adapter = getAdapter(toolId);
        if (!adapter) {
            errors.push(`No adapter found for tool: ${toolId}`);
            continue;
        }
        try {
            const settingsPath = join(targetPath, adapter.getSettingsPath());
            const content = adapter.formatSettings(agents, skills);
            ensureParentDir(settingsPath);
            writeFileSync(settingsPath, content, 'utf-8');
            count++;
        }
        catch (err) {
            errors.push(`Settings generation failed for ${toolId}: ${err.message}`);
        }
    }
    return { count, errors };
}
/** Print a summary of settings generation */
export function printSettingsSummary(result) {
    if (result.count > 0) {
        logger.success(`Settings generated for ${result.count} tool(s)`);
    }
    for (const err of result.errors) {
        logger.error(err);
    }
}
//# sourceMappingURL=settings-generator.js.map