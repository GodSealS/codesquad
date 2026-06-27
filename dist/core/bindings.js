/**
 * Binding Manager
 *
 * Handles adding and removing AI tool bindings from a project.
 * Reads codesquad.config.yaml, modifies the tools list, and triggers regeneration.
 */
import { resolve } from 'path';
import { getBoundTools, setBoundTools } from './project-config.js';
import { getAdapter, getAvailableAdapters } from '../adapters/index.js';
import { loadAgents, generateAgents } from '../generators/agent-generator.js';
import { loadSkills, generateSkills } from '../generators/skill-generator.js';
import { logger } from '../utils/logger.js';
import { removeSafe } from '../utils/fs.js';
import { getToolDir } from './config.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { loadModelsConfig } from './models.js';
import { AICORE_CONTENT_ROOT } from './paths.js';
/**
 * Add a tool binding to the project.
 * Regenerates agent and skill files for the newly added tool.
 */
export async function addBinding(options) {
    const targetPath = resolve(options.targetPath);
    const tool = options.tool.trim().toLowerCase();
    // Validate tool exists
    const adapter = getAdapter(tool);
    if (!adapter) {
        const available = getAvailableAdapters().join(', ');
        logger.error(`Unknown tool: ${tool}. Available: ${available}`);
        throw new Error(`Unknown tool binding: "${tool}". Available: ${available}`);
    }
    // Read current bindings
    const current = getBoundTools(targetPath);
    if (current.includes(tool)) {
        logger.warn(`Tool '${tool}' is already bound.`);
        return;
    }
    // Add and save
    const updated = [...current, tool];
    setBoundTools(targetPath, updated);
    logger.success(`Added binding for ${tool}`);
    // Load models config (read-only — bind does NOT auto-generate)
    // Note: bind commands do not trigger models.config.yaml creation.
    // Only `init` generates models.config.yaml with tool-appropriate defaults.
    // Reason: bind is "add a tool," not "initialise the project."
    let modelsConfig;
    const modelsConfigPath = join(targetPath, 'models.config.yaml');
    if (existsSync(modelsConfigPath)) {
        try {
            modelsConfig = loadModelsConfig(targetPath);
        }
        catch (err) {
            logger.warn(`Failed to load models.config.yaml: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    // Load canonical definitions from AICore content source
    // Uses @codesquad/aicore-content private package if installed, else bundled AICore/
    const aicoreRoot = AICORE_CONTENT_ROOT;
    const agents = await loadAgents(aicoreRoot);
    const skills = await loadSkills(join(aicoreRoot, 'skills'));
    // Generate files for the new tool
    logger.step(tool, 'Generating agents & skills...');
    const agentResult = generateAgents(adapter, agents, targetPath, modelsConfig);
    const skillResult = generateSkills(adapter, skills, targetPath, modelsConfig, join(aicoreRoot, 'skills'));
    logger.success(`${tool}: ${agentResult.count} agents, ${skillResult.count} skills generated`);
}
/**
 * Remove a tool binding from the project.
 * Deletes the generated tool directory and updates config.
 */
export async function removeBinding(options) {
    const targetPath = resolve(options.targetPath);
    const tool = options.tool.trim().toLowerCase();
    // Read current bindings
    const current = getBoundTools(targetPath);
    if (!current.includes(tool)) {
        logger.warn(`Tool '${tool}' is not currently bound.`);
        return;
    }
    // Remove from list
    const updated = current.filter((t) => t !== tool);
    setBoundTools(targetPath, updated);
    // Clean up generated directory
    const toolDir = join(targetPath, getToolDir(tool));
    removeSafe(toolDir);
    logger.success(`Removed binding for ${tool}`);
    logger.info(`Cleaned up ${getToolDir(tool)}/ directory`);
}
/** List all currently bound tools */
export async function listBindings(options) {
    const targetPath = resolve(options.targetPath);
    const tools = getBoundTools(targetPath);
    if (tools.length === 0) {
        logger.info('No tools currently bound. Run `codesquad init --tools <tool>` to bind tools.');
        return;
    }
    logger.title('Bound Tools');
    for (const tool of tools) {
        const adapter = getAdapter(tool);
        const label = adapter ? tool : `${tool} (no adapter)`;
        console.log(`  • ${label}`);
    }
    console.log();
}
//# sourceMappingURL=bindings.js.map