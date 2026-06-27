/**
 * Update Core
 *
 * Regenerate agent/skill files from canonical sources.
 * Phase 7.5: Enhanced with lockfile-based incremental updates.
 * Supports --force, --preserve, --dry-run modes.
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { getAdapter } from '../adapters/index.js';
import { loadAgents, generateAgents } from '../generators/agent-generator.js';
import { loadSkills, generateSkills } from '../generators/skill-generator.js';
import { parse as parseYaml } from 'yaml';
import { logger } from '../utils/logger.js';
import { readLock, writeLock, checkFileStatus } from './lockfile.js';
import { getToolDir } from './config.js';
import { loadModelsConfig } from './models.js';
import { CLI_PACKAGE_ROOT, AICORE_CONTENT_ROOT } from './paths.js';
/**
 * Regenerate files for bound tools in the target project.
 */
export async function updateProject(options) {
    const targetPath = resolve(options.targetPath || '.');
    const mode = options.dryRun ? ' (DRY RUN)' : '';
    logger.title(`CodeSquad Update${mode}`);
    // Read existing lockfile
    const lock = readLock(targetPath);
    // Read config to find bound tools
    const configPath = join(targetPath, 'codesquad.config.yaml');
    if (!existsSync(configPath)) {
        logger.error('No codesquad.config.yaml found. Run `codesquad init` first.');
        return;
    }
    let toolIds;
    try {
        const raw = readFileSync(configPath, 'utf-8');
        const config = parseYaml(raw);
        toolIds = options.tools
            ? options.tools.split(',').map((t) => t.trim()).filter(Boolean)
            : (config.tools ?? ['codebuddy']);
    }
    catch {
        logger.error('Failed to parse codesquad.config.yaml');
        return;
    }
    logger.info(`Tools: ${toolIds.join(', ')}`);
    // Load canonical agents and skills from AICore content source
    // Uses @codesquad/aicore-content private package if installed, else bundled AICore/
    const aicoreRoot = AICORE_CONTENT_ROOT;
    const agents = await loadAgents(aicoreRoot);
    const skills = await loadSkills(join(aicoreRoot, 'skills'));
    logger.info(`Source: ${agents.length} agents, ${skills.length} skills`);
    // Load models config
    let modelsConfig;
    const modelsConfigPath = join(targetPath, 'models.config.yaml');
    if (existsSync(modelsConfigPath)) {
        try {
            modelsConfig = loadModelsConfig(targetPath);
        }
        catch (err) {
            logger.warn(`Failed to parse models.config.yaml: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    let skippedCount = 0;
    let updatedCount = 0;
    let diffFiles = [];
    // Regenerate for each tool
    for (const toolId of toolIds) {
        const adapter = getAdapter(toolId);
        if (!adapter) {
            logger.warn(`No adapter found: ${toolId}, skipping`);
            continue;
        }
        logger.step(toolId, options.dryRun ? 'Previewing...' : 'Regenerating...');
        // Check lockfile status for each generated file.
        // Enter the scan loop when:
        //   (a) lockfile exists AND preserve mode is on — protect user edits from overwrite
        //   (b) --diff is requested — enumerate all files regardless of lockfile
        const toolDir = getToolDir(toolId);
        if ((lock && options.preserve) || options.diff) {
            if (options.preserve)
                logger.info('Preserve mode: scanning for user modifications...');
            if (options.diff && !lock)
                logger.info('Diff mode: no lockfile found, treating all existing files as "new"');
            const agentOutputDir = join(targetPath, toolDir, 'agents');
            const skillOutputDir = join(targetPath, toolDir, 'skills');
            // Scan existing agent files
            if (existsSync(agentOutputDir)) {
                for (const file of readdirSync(agentOutputDir).filter((f) => f.endsWith('.md'))) {
                    try {
                        const filePath = join(agentOutputDir, file);
                        const relPath = `${toolDir}/agents/${file}`;
                        const content = readFileSync(filePath, 'utf-8');
                        const status = lock ? checkFileStatus(lock, relPath, content) : 'unknown';
                        if (status === 'modified') {
                            diffFiles.push(`[MODIFIED] ${relPath}`);
                            if (options.preserve) {
                                logger.warn(`User-modified file protected: ${relPath}`);
                                skippedCount++;
                            }
                        }
                        else if (status === 'new') {
                            diffFiles.push(`[NEW]      ${relPath}`);
                        }
                    }
                    catch { /* skip unreadable files */ }
                }
            }
            // Scan existing skill files
            if (existsSync(skillOutputDir)) {
                const walkSkills = (dir, prefix) => {
                    for (const entry of readdirSync(dir, { withFileTypes: true })) {
                        if (entry.isDirectory()) {
                            walkSkills(join(dir, entry.name), `${prefix}${entry.name}/`);
                        }
                        else if (entry.isFile()) {
                            try {
                                const filePath = join(dir, entry.name);
                                const relPath = `${toolDir}/skills/${prefix}${entry.name}`;
                                const content = readFileSync(filePath, 'utf-8');
                                const status = lock ? checkFileStatus(lock, relPath, content) : 'unknown';
                                if (status === 'modified') {
                                    diffFiles.push(`[MODIFIED] ${relPath}`);
                                    if (options.preserve) {
                                        logger.warn(`User-modified file protected: ${relPath}`);
                                        skippedCount++;
                                    }
                                }
                                else if (status === 'new') {
                                    diffFiles.push(`[NEW]      ${relPath}`);
                                }
                            }
                            catch { /* skip unreadable files */ }
                        }
                    }
                };
                walkSkills(skillOutputDir, '');
            }
        }
        if (options.dryRun) {
            logger.info('Dry run — no files will be written');
            logger.info(`Would update: ${agents.length} agents, ${skills.length} skills`);
            continue;
        }
        const agentResult = generateAgents(adapter, agents, targetPath, modelsConfig);
        const skillResult = generateSkills(adapter, skills, targetPath, modelsConfig, join(aicoreRoot, 'skills'));
        if (options.force) {
            logger.info('Force mode: overwriting all files');
        }
        updatedCount += agentResult.count + skillResult.count;
        logger.success(`${toolId}: ${agentResult.count} agents, ${skillResult.count} skills updated`);
        if (agentResult.errors.length > 0) {
            agentResult.errors.forEach((e) => logger.error(e));
        }
        if (skillResult.errors.length > 0) {
            skillResult.errors.forEach((e) => logger.error(e));
        }
    }
    // Write new lockfile after successful update
    if (!options.dryRun) {
        try {
            const pkgPath = join(CLI_PACKAGE_ROOT, 'package.json');
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            const lockFiles = new Map();
            for (const toolId of toolIds) {
                const toolDir = getToolDir(toolId);
                lockFiles.set(`${toolDir}/agents/`, `updated ${toolDir}/agents/`);
                lockFiles.set(`${toolDir}/skills/`, `updated ${toolDir}/skills/`);
            }
            writeLock(targetPath, pkg.version ?? '0.1.0', pkg.version ?? '0.1.0', lockFiles);
        }
        catch {
            // lockfile is optional
        }
    }
    logger.title('Update Complete');
    if (skippedCount > 0) {
        logger.info(`${skippedCount} files skipped (user-modified, use --force to override)`);
    }
    if (options.dryRun) {
        logger.info('Dry run complete — no files were modified');
    }
    if (options.diff && diffFiles.length > 0) {
        logger.info(`\n── File Changes ──`);
        for (const f of diffFiles) {
            logger.info(`  ${f}`);
        }
    }
}
//# sourceMappingURL=update-core.js.map