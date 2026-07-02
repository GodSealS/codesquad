/**
 * Init Core
 *
 * Project initialization: detect state, prompt for tools, generate files.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'fs';
import { join, resolve as pathResolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getToolByValue, getToolDir } from './config.js';
import { getAdapter, getAvailableAdapters } from '../adapters/index.js';
import { loadAgents, generateAgents } from '../generators/agent-generator.js';
import { loadSkills, generateSkills } from '../generators/skill-generator.js';
import { DEFAULT_PROJECT_CONFIG } from '../schemas/config.schema.js';
import { logger } from '../utils/logger.js';
import { writeLock } from './lockfile.js';
import { loadOrInitModelsConfig, writeModelsConfigTemplate } from './models.js';
import { AICORE_CONTENT_ROOT, CLI_PACKAGE_ROOT, PROJECT_INSTALL_CONFIG_PATH, isEmbeddedMode, readAicoreFile, readAicoreDir } from './paths.js';
import { injectMcpServerConfig } from '../commands/mcp.js';
import { parse as parseYaml } from 'yaml';
import { readEmbeddedFile, readEmbeddedDir } from '../embedded/runtime.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * Initialize CodeSquad in a project directory.
 *
 * Without --tools: install project config files only (CODESQUAD.md, etc.)
 * With    --tools: full init — generate agents/skills + install project files
 */
export async function initProject(options) {
    const targetPath = pathResolve(options.targetPath || '.');
    logger.title('CodeSquad Init');
    // Resolve which tools to bind
    const toolIds = resolveTools(options.tools);
    if (toolIds.length === 0) {
        // No tools specified → install project files only (lightweight init)
        logger.info(`Target: ${targetPath}`);
        logger.info('Mode:  project-files-only (use --tools <tool> for full init)');
        mkdirSync(targetPath, { recursive: true });
        const count = installProjectFiles(targetPath, options.force);
        if (count > 0) {
            logger.success(`Installed ${count} project file(s)`);
        }
        else {
            logger.warn('No project files installed — config may be empty');
        }
        return;
    }
    logger.info(`Target: ${targetPath}`);
    logger.info(`Tools:  ${toolIds.join(', ')}`);
    // Ensure target directory exists
    mkdirSync(targetPath, { recursive: true });
    // Load canonical agents and skills from .codesquad content source
    // Uses @codesquad/aicore-content private package if installed, else bundled .codesquad/
    const aicoreRoot = AICORE_CONTENT_ROOT;
    logger.info(`Content source: ${aicoreRoot}`);
    const agents = await loadAgents(aicoreRoot);
    const skills = await loadSkills(join(aicoreRoot, 'skills'));
    logger.info(`Loaded ${agents.length} agents, ${skills.length} skills`);
    // Load or auto-generate models config with tool-appropriate defaults.
    // If the file didn't exist before and the generated config is empty,
    // replace it with a commented template for easy editing.
    const modelsConfigExistsBefore = existsSync(join(targetPath, 'models.config.yaml'));
    const modelsConfig = loadOrInitModelsConfig(targetPath, toolIds);
    if (modelsConfigExistsBefore) {
        logger.info('Found models.config.yaml');
    }
    else {
        // Check if generated config is effectively empty — replace with template
        const hasContent = Object.keys(modelsConfig.agents ?? {}).length > 0
            || Object.keys(modelsConfig.skills ?? {}).length > 0
            || Object.keys(modelsConfig.batch ?? {}).length > 0
            || modelsConfig.default !== null
            || (modelsConfig.api?.sources && Object.keys(modelsConfig.api.sources).length > 0);
        if (hasContent) {
            logger.success('Generated models.config.yaml with tool-appropriate defaults');
        }
        else {
            writeModelsConfigTemplate(targetPath, true);
            logger.success('Created models.config.yaml with template and usage comments');
        }
    }
    // Write project config
    const config = { ...DEFAULT_PROJECT_CONFIG, tools: toolIds };
    const configPath = join(targetPath, 'codesquad.config.yaml');
    // Simple YAML writing (avoid zod for now since we just need to serialize)
    writeFileSync(configPath, `# CodeSquad Project Configuration\nversion: 1\ntools:\n${toolIds.map((t) => `  - ${t}`).join('\n')}\nengine:\n  name: custom\n  version: \"\"\ngeneration:\n  overwriteOnUpdate: true\n  skipSettings: false\n`, 'utf-8');
    logger.success('Created codesquad.config.yaml');
    // Generate files for each tool
    const results = [];
    for (const toolId of toolIds) {
        const adapter = getAdapter(toolId);
        if (!adapter) {
            logger.warn(`No adapter found for tool: ${toolId}, skipping`);
            continue;
        }
        logger.step(toolId, 'Generating agents & skills...');
        const agentResult = generateAgents(adapter, agents, targetPath, modelsConfig);
        const skillResult = generateSkills(adapter, skills, targetPath, modelsConfig, join(aicoreRoot, 'skills'));
        const tool = getToolByValue(toolId);
        logger.success(`${tool?.successLabel ?? toolId}: ${agentResult.count} agents, ${skillResult.count} skills`);
        if (agentResult.errors.length > 0) {
            agentResult.errors.forEach((e) => logger.error(e));
        }
        if (skillResult.errors.length > 0) {
            skillResult.errors.forEach((e) => logger.error(e));
        }
    }
    // Install project-level files per Config/project_file_install_config.yaml
    const projectFilesCount = installProjectFiles(targetPath, options.force);
    if (projectFilesCount > 0) {
        logger.success(`Installed ${projectFilesCount} project files`);
    }
    // Copy IDE infrastructure files (hooks, rules, settings, statusline) to tool directories
    const auxDirs = ['docs', 'hooks', 'rules'];
    const auxFiles = ['statusline.sh', 'settings.json'];
    const auxCopied = copyAicoreAux(aicoreRoot, targetPath, toolIds, options.force, auxDirs, auxFiles);
    if (auxCopied > 0) {
        logger.success(`Copied ${auxCopied} auxiliary files to tool dirs (${auxDirs.join(', ')})`);
    }
    // Write lockfile for future incremental updates
    try {
        const pkgPath = join(CLI_PACKAGE_ROOT, 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        const lockFiles = new Map();
        // Record the generated output paths
        for (const toolId of toolIds) {
            const toolDir = getToolDir(toolId);
            const agentDir = join(targetPath, toolDir, 'agents');
            const skillDir = join(targetPath, toolDir, 'skills');
            lockFiles.set(`${toolDir}/agents/`, `generated ${agentDir}`);
            lockFiles.set(`${toolDir}/skills/`, `generated ${skillDir}`);
        }
        writeLock(targetPath, pkg.version ?? '0.1.0', pkg.version ?? '0.1.0', lockFiles);
        logger.info('Created .codesquad.lock for future incremental updates');
    }
    catch {
        logger.warn('Could not write .codesquad.lock');
    }
    // Auto-inject MCP server config into .codesquad/settings.json
    if (toolIds.includes('codebuddy')) {
        injectMcpServerConfig(targetPath);
    }
    logger.title('Init Complete');
    logger.info(`Run ${'`codesquad start`'.toLowerCase()} to begin the guided onboarding.`);
}
/** Resolve tool IDs from --tools flag */
function resolveTools(tools) {
    if (!tools)
        return [];
    if (tools === 'all') {
        return getAvailableAdapters();
    }
    return tools.split(',').map((t) => t.trim()).filter(Boolean);
}
/**
 * Install project-level files according to Config/project_file_install_config.yaml.
 *
 * Path resolution:
 * - `Root/` prefix in `from` → CLI_PACKAGE_ROOT
 * - `${Project}` placeholder in `dist` → targetPath
 *
 * Existing files are skipped unless `force` is true.
 */
export function installProjectFiles(targetPath, force) {
    // ── Load config: try embedded first, then disk ──
    const CONFIG_EMBEDDED_KEY = 'Config/project_file_install_config.yaml';
    let configRaw = readEmbeddedFile(CONFIG_EMBEDDED_KEY);
    if (configRaw === null && existsSync(PROJECT_INSTALL_CONFIG_PATH)) {
        try {
            configRaw = readFileSync(PROJECT_INSTALL_CONFIG_PATH, 'utf-8');
        }
        catch { /* fall through */ }
    }
    if (!configRaw) {
        logger.warn('project_file_install_config.yaml not found');
        return 0;
    }
    let config = null;
    try {
        config = parseYaml(configRaw);
    }
    catch {
        logger.warn('Failed to parse project_file_install_config.yaml');
        return 0;
    }
    if (!config?.project_file_install_config) {
        logger.warn('No project_file_install_config entries found');
        return 0;
    }
    const rootDir = CLI_PACKAGE_ROOT;
    let count = 0;
    for (const [name, entry] of Object.entries(config.project_file_install_config)) {
        const relPath = entry.from.replace(/^Root\//, '');
        const srcPath = join(rootDir, relPath);
        const destPath = entry.dist.replace(/\$\{Project\}/g, targetPath);
        // 🔧 Fix: 始终先尝试嵌入数据，再回退磁盘。解决两个问题：
        //   1. isEmbeddedMode() 在某些 Bun 版本下可能误判为 false
        //   2. .codesquad/ 根文件的嵌入 key 不含 .codesquad/ 前缀
        //      (embed-aicore.ts 把 CODESQUAD.md/settings.json 存为顶层 key)
        const normRel = relPath.replace(/\\/g, '/');
        // ── Try embedded file (full path + stripped .codesquad/ prefix) ──
        let content = readEmbeddedFile(normRel);
        if (content === null && normRel.startsWith('.codesquad/')) {
            content = readEmbeddedFile(normRel.slice('.codesquad/'.length));
        }
        if (content !== null) {
            if (existsSync(destPath) && !force) {
                logger.info(`"${name}" already exists — skipping`);
                continue;
            }
            mkdirSync(dirname(destPath), { recursive: true });
            writeFileSync(destPath, content, 'utf-8');
            logger.info(`Installed "${name}"`);
            count++;
            continue;
        }
        // ── Try embedded directory ──
        let dirEntries = readEmbeddedDir(normRel);
        if (dirEntries.length > 0) {
            if (existsSync(destPath) && !force) {
                logger.info(`"${name}" already exists — skipping`);
                continue;
            }
            const dirCount = walkCopyEmbeddedTree(normRel, destPath, force);
            logger.info(`Installed "${name}" (${dirCount} files)`);
            count += dirCount;
            continue;
        }
        // ── Fallback: disk ──
        if (!existsSync(srcPath)) {
            logger.warn(`Source not found for "${name}": ${normRel}`);
            continue;
        }
        const srcStat = statSync(srcPath);
        const isDir = srcStat.isDirectory();
        if (isDir) {
            if (existsSync(destPath) && !force) {
                logger.info(`"${name}" already exists — skipping`);
                continue;
            }
            const dirCount = walkCopyDir(srcPath, destPath, force);
            logger.info(`Installed "${name}" (${dirCount} files)`);
            count += dirCount;
        }
        else {
            if (existsSync(destPath) && !force) {
                logger.info(`"${name}" already exists — skipping`);
                continue;
            }
            mkdirSync(dirname(destPath), { recursive: true });
            copyFileSync(srcPath, destPath);
            logger.info(`Installed "${name}"`);
            count++;
        }
    }
    return count;
}
/**
 * Copy .codesquad auxiliary directories and files from CLI package to each tool's target directory.
 * @param auxDirs  Subdirectories under .codesquad/ to copy (e.g. ['hooks', 'rules']). Defaults to ['docs', 'hooks', 'rules'].
 * @param auxFiles Root-level files under .codesquad/ to copy (e.g. ['settings.json']). Defaults to ['statusline.sh', 'settings.json'].
 */
function copyAicoreAux(aicoreRoot, targetPath, toolIds, force, auxDirs, auxFiles) {
    // ── Embedded mode: read from in-memory constants, write to disk ──
    if (isEmbeddedMode()) {
        let count = 0;
        const dirs = auxDirs ?? ['docs', 'hooks', 'rules'];
        const files = auxFiles ?? ['statusline.sh', 'settings.json'];
        for (const toolId of toolIds) {
            const adapter = getAdapter(toolId);
            if (!adapter)
                continue;
            const settingsRel = adapter.getSettingsPath();
            const toolDir = dirname(settingsRel);
            const targetToolDir = join(targetPath, toolDir);
            // Copy subdirectories from embedded data (recursive)
            for (const dir of dirs) {
                const rootEntries = readAicoreDir(dir);
                if (rootEntries.length === 0)
                    continue;
                count += walkCopyEmbeddedDir(dir, join(targetToolDir, dir), force);
            }
            // Copy root-level files
            for (const file of files) {
                const content = readAicoreFile(file);
                if (content === null)
                    continue;
                const destFile = join(targetToolDir, file);
                if (file === 'settings.json') {
                    const schemaUrl = adapter.getSettingsSchemaUrl?.();
                    const existedBefore = existsSync(destFile);
                    // For non-CodeBuddy tools, use adapter.formatSettings() like dev mode
                    const isCodebuddy = toolId === 'codebuddy';
                    const settingsContent = isCodebuddy
                        ? content
                        : adapter.formatSettings([], []);
                    if (mergeSettingsJson(settingsContent, destFile, toolDir, schemaUrl)) {
                        count++;
                        if (existedBefore) {
                            logger.info(`  Merged missing keys into ${toolDir}/settings.json`);
                        }
                    }
                }
                else {
                    if (!existsSync(destFile) || force) {
                        mkdirSync(dirname(destFile), { recursive: true });
                        writeFileSync(destFile, content, 'utf-8');
                        count++;
                    }
                }
            }
        }
        return count;
    }
    // ── Dev mode: disk to disk copy ──
    if (!existsSync(aicoreRoot))
        return 0;
    let count = 0;
    // Subdirectories to copy (skip agents/ and skills/ — already generated by adapters)
    const dirs = auxDirs ?? ['docs', 'hooks', 'rules'];
    // Root-level files to copy (templates / shared config)
    const files = auxFiles ?? ['statusline.sh', 'settings.json'];
    for (const toolId of toolIds) {
        const adapter = getAdapter(toolId);
        if (!adapter)
            continue;
        // Extract tool directory from adapter's settings path (e.g., ".codesquad/settings.json" → ".codesquad")
        const settingsRel = adapter.getSettingsPath();
        const toolDir = dirname(settingsRel); // e.g., ".codesquad", ".claude"
        const targetToolDir = join(targetPath, toolDir);
        for (const dir of dirs) {
            const srcDir = join(aicoreRoot, dir);
            if (!existsSync(srcDir))
                continue;
            count += walkCopyDir(srcDir, join(targetToolDir, dir), force);
        }
        for (const file of files) {
            const srcFile = join(aicoreRoot, file);
            if (!existsSync(srcFile))
                continue;
            const destFile = join(targetToolDir, file);
            if (file === 'settings.json') {
                // settings.json: deep-merge tool-appropriate template into user file.
                // - CodeBuddy: use .codesquad/settings.json template (hooks, permissions, sandbox)
                // - Other tools: use adapter.formatSettings() output (tool-specific format)
                // User customizations always win; template only fills gaps.
                // {{TOOL_DIR}} and {{TOOL_SCHEMA}} are replaced per-tool.
                const isCodebuddy = toolId === 'codebuddy';
                const templateContent = isCodebuddy
                    ? readFileSync(srcFile, 'utf-8')
                    : adapter.formatSettings([], []);
                const schemaUrl = adapter.getSettingsSchemaUrl?.();
                const existedBefore = existsSync(destFile);
                if (mergeSettingsJson(templateContent, destFile, toolDir, schemaUrl)) {
                    count++;
                    if (!existedBefore) {
                        // Fresh creation — silent (count++ is sufficient)
                    }
                    else {
                        logger.info(`  Merged missing keys into ${toolDir}/settings.json`);
                    }
                }
            }
            else {
                if (!existsSync(destFile) || force) {
                    mkdirSync(dirname(destFile), { recursive: true });
                    copyFileSync(srcFile, destFile);
                    count++;
                }
            }
        }
    }
    return count;
}
/**
 * Deep-merge .codesquad settings template into the user's existing settings file.
 *
 * Strategy:
 * - Top-level keys missing in user → added from template
 * - Primitive values → user's value wins
 * - Nested objects → recursively merged (user keys win)
 * - Arrays (permissions.allow/deny) → additive: template entries not in user are appended
 * - Hook arrays → additive: template hooks not matching existing command+type are appended
 * - {{TOOL_DIR}} → replaced with tool directory (e.g., ".codesquad")
 * - {{TOOL_SCHEMA}} → replaced with tool-specific schema URL (or empty string)
 *
 * @returns true if the file was written (created or modified)
 */
function mergeSettingsJson(templateContent, destFile, toolDir, schemaUrl) {
    // Apply placeholder replacements
    const processed = templateContent
        .replace(/\{\{TOOL_DIR\}\}/g, toolDir)
        .replace(/\{\{TOOL_SCHEMA\}\}/g, schemaUrl ?? '');
    const template = JSON.parse(processed);
    if (!existsSync(destFile)) {
        mkdirSync(dirname(destFile), { recursive: true });
        writeFileSync(destFile, JSON.stringify(template, null, 2) + '\n', 'utf-8');
        return true;
    }
    try {
        const raw = readFileSync(destFile, 'utf-8');
        const user = JSON.parse(raw);
        const merged = deepMerge(template, user);
        const result = JSON.stringify(merged, null, 2) + '\n';
        if (result !== raw) {
            writeFileSync(destFile, result, 'utf-8');
            return true;
        }
        return false;
    }
    catch {
        // User's file is invalid JSON — leave it untouched
        return false;
    }
}
/**
 * Deep merge where user values always win, template fills gaps.
 * - Primitives: user value preserved
 * - Objects: recursively merged (user keys win)
 * - String arrays: additive (template entries appended if not present)
 * - Object arrays with "command" key (hooks): merged by command+type identity
 */
function deepMerge(template, user) {
    if (user === undefined || user === null)
        return template;
    if (template === undefined || template === null)
        return user;
    // Arrays: additive merge
    if (Array.isArray(template) && Array.isArray(user)) {
        if (template.length === 0)
            return user;
        // String arrays (permissions.allow/deny): add missing template entries
        if (template.every((t) => typeof t === 'string')) {
            const merged = [...user.filter((u) => typeof u === 'string')];
            for (const item of template) {
                if (!merged.includes(item))
                    merged.push(item);
            }
            return merged;
        }
        // Object arrays with "command" + "type" (hooks): merge by identity
        if (template.every((t) => typeof t === 'object' && t !== null && 'command' in t)) {
            const merged = [...user];
            for (const tItem of template) {
                const tCmd = tItem['command'];
                const tType = tItem['type'];
                const exists = merged.some((uItem) => {
                    if (typeof uItem !== 'object' || uItem === null)
                        return false;
                    const u = uItem;
                    return u['command'] === tCmd && u['type'] === tType;
                });
                if (!exists)
                    merged.push(tItem);
            }
            return merged;
        }
        return user;
    }
    // Objects: recursively merge
    if (typeof template === 'object' && typeof user === 'object' && template !== null && user !== null) {
        const result = { ...user };
        for (const key of Object.keys(template)) {
            if (!(key in result)) {
                result[key] = template[key];
            }
            else {
                result[key] = deepMerge(template[key], result[key]);
            }
        }
        return result;
    }
    // Primitives: user wins
    return user;
}
/**
 * Recursively copy a directory from embedded data to disk.
 * Used only in embedded (Bun compile) mode.
 *
 * @param relativeDir  Path relative to .codesquad root (e.g. "docs/templates")
 * @param destDir      Absolute disk path to write to
 * @param force        Overwrite existing files
 */
function walkCopyEmbeddedDir(relativeDir, destDir, force) {
    const entries = readAicoreDir(relativeDir);
    let count = 0;
    for (const entry of entries) {
        const subPath = `${relativeDir}/${entry}`;
        const subEntries = readAicoreDir(subPath);
        if (subEntries.length > 0) {
            // Directory — recurse
            const destSub = join(destDir, entry);
            mkdirSync(destSub, { recursive: true });
            count += walkCopyEmbeddedDir(subPath, destSub, force);
        }
        else {
            // File — read from embedded and write to disk
            const content = readAicoreFile(subPath);
            if (content !== null) {
                const destPath = join(destDir, entry);
                if (!existsSync(destPath) || force) {
                    mkdirSync(dirname(destPath), { recursive: true });
                    writeFileSync(destPath, content, 'utf-8');
                    count++;
                }
            }
        }
    }
    return count;
}
/**
 * Recursively copy a directory tree from embedded data to disk.
 * Works with project-root embedded paths (e.g. "docs/", "design/", "Config/").
 * Unlike walkCopyEmbeddedDir, this reads directly from EMBEDDED_FILES/DIRS.
 *
 * @param relativePrefix  Path prefix in embedded data (e.g. "docs")
 * @param destDir         Absolute disk path to write to
 * @param force           Overwrite existing files
 */
function walkCopyEmbeddedTree(relativePrefix, destDir, force) {
    const entries = readEmbeddedDir(relativePrefix);
    if (entries.length === 0)
        return 0;
    let count = 0;
    mkdirSync(destDir, { recursive: true });
    for (const entry of entries) {
        const subPath = `${relativePrefix}/${entry}`;
        const subEntries = readEmbeddedDir(subPath);
        if (subEntries.length > 0) {
            // Directory — recurse
            const destSub = join(destDir, entry);
            count += walkCopyEmbeddedTree(subPath, destSub, force);
        }
        else {
            // File — read from embedded and write to disk
            const content = readEmbeddedFile(subPath);
            if (content !== null) {
                const destPath = join(destDir, entry);
                if (!existsSync(destPath) || force) {
                    writeFileSync(destPath, content, 'utf-8');
                    count++;
                }
            }
        }
    }
    return count;
}
/** Recursively copy a directory, skipping existing files unless force=true */
function walkCopyDir(src, dest, force) {
    let count = 0;
    mkdirSync(dest, { recursive: true });
    const entries = readdirSync(src);
    for (const entry of entries) {
        const srcPath = join(src, entry);
        const destPath = join(dest, entry);
        const stat = statSync(srcPath);
        if (stat.isDirectory()) {
            count += walkCopyDir(srcPath, destPath, force);
        }
        else {
            if (!existsSync(destPath) || force) {
                copyFileSync(srcPath, destPath);
                count++;
            }
        }
    }
    return count;
}
//# sourceMappingURL=init-core.js.map