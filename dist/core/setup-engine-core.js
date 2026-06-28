/**
 * Setup Engine Core
 *
 * Equivalent of the /setup-engine skill for the CLI.
 * Handles engine selection, config updates, directory scaffolding,
 * and engine reference doc generation.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { parse as parseYaml } from 'yaml';
import { select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PACKAGE_ROOT = resolve(__dirname, '..', '..');
/* ── engine metadata ───────────────────────────── */
export const ENGINE_META = {
    godot: { display: 'Godot 4', languages: ['gdscript', 'csharp', 'both'], defaultLang: 'gdscript' },
    unity: { display: 'Unity', languages: ['csharp'], defaultLang: 'csharp' },
    unreal: { display: 'Unreal Engine 5', languages: ['cpp+blueprint'], defaultLang: 'cpp+blueprint' },
    cocos: { display: 'Cocos Creator', languages: ['typescript', 'javascript'], defaultLang: 'typescript' },
    custom: { display: 'Custom', languages: [], defaultLang: '' },
};
/* ── directory templates ───────────────────────── */
const ENGINE_DIRS = {
    godot: [
        'scenes', 'scripts', 'assets/textures', 'assets/models', 'assets/audio',
        'assets/fonts', 'themes', 'autoload', 'addons', 'shaders', 'resources',
        'builds', 'docs', 'tests',
    ],
    unity: [
        'Assets', 'Assets/_ProjectName', 'Assets/_ProjectName/Art',
        'Assets/_ProjectName/Audio', 'Assets/_ProjectName/Prefabs',
        'Assets/_ProjectName/Scenes', 'Assets/_ProjectName/Scripts/Runtime',
        'Assets/_ProjectName/Scripts/Editor', 'Assets/Plugins',
        'Assets/Resources', 'Assets/StreamingAssets', 'Assets/Settings',
    ],
    unreal: [
        'Config', 'Content', 'Source', 'Plugins',
    ],
    cocos: [
        'assets/scenes', 'assets/scripts', 'assets/prefabs', 'assets/textures',
        'assets/materials', 'assets/models', 'assets/animations', 'assets/audio',
        'assets/resources',
    ],
};
const ENGINE_GITIGNORE = {
    godot: [
        '# Godot 4.x',
        '.godot/',
        '.import/',
        'builds/',
        'exports/',
        '*.translation',
        '*.remap',
        '# C# (if using Mono/C#)',
        'bin/',
        'obj/',
    ].join('\n'),
    unity: [
        '# Unity',
        '[Ll]ibrary/',
        '[Tt]emp/',
        '[Ll]ogs/',
        '[Uu]ser[Ss]ettings/',
        '# Builds',
        'Builds/',
        '*.apk',
        '*.ipa',
    ].join('\n'),
    unreal: [
        '# Unreal Engine',
        'Binaries/',
        'Intermediate/',
        'Saved/',
        'DerivedDataCache/',
        'Build/',
    ].join('\n'),
    cocos: [
        '# Cocos Creator',
        '/local/',
        '/profiles/',
        '/temp/',
        '/dist/',
        '/build/',
        '# Do NOT ignore .meta files!',
    ].join('\n'),
};
/* ── CODESQUAD.md engine templates ──────────────── */
const ENGINE_TECH_STACK = {
    godot: '- **Engine**: Godot [version]\n- **Language**: GDScript\n- **Build System**: SCons (engine), Godot Export Templates\n- **Asset Pipeline**: Godot Import System + custom resource pipeline',
    unity: '- **Engine**: Unity [version]\n- **Language**: C#\n- **Build System**: Unity Build Pipeline\n- **Asset Pipeline**: Unity Asset Import Pipeline + Addressables',
    unreal: '- **Engine**: Unreal Engine [version]\n- **Language**: C++ (primary), Blueprint (gameplay prototyping)\n- **Build System**: Unreal Build Tool (UBT)\n- **Asset Pipeline**: Unreal Content Pipeline',
    cocos: '- **Engine**: Cocos Creator [version]\n- **Language**: TypeScript\n- **Build System**: Cocos Creator Build Pipeline\n- **Asset Pipeline**: Cocos Creator Asset Database + dynamic load',
};
/* ── guided engine selection ───────────────────── */
async function selectEngine() {
    console.log();
    const answer = await select({
        message: 'Which game engine would you like to use?',
        choices: [
            { name: 'Godot 4 — 2D best-in-class, free (MIT), rapid iteration', value: 'godot' },
            { name: 'Unity — Industry standard 3D/mobile, massive ecosystem', value: 'unity' },
            { name: 'Unreal Engine 5 — AAA 3D, photorealistic, Blueprint + C++', value: 'unreal' },
            { name: 'Cocos Creator — Web/mobile/WeChat mini-games, TypeScript', value: 'cocos' },
            { name: 'Custom / Other engine', value: 'custom' },
        ],
    });
    return answer;
}
async function askVersion() {
    return input({
        message: 'Engine version (e.g., 4.4, 2023.2, 5.4, 3.8):',
        validate: (v) => v.trim().length > 0 || 'Version is required',
    });
}
async function askGodotLang() {
    const answer = await select({
        message: 'Godot language (see Appendix A in the setup-engine skill for details):',
        choices: [
            { name: 'GDScript — Python-like, Godot-native, fastest iteration', value: 'gdscript' },
            { name: 'C# — .NET 8+, familiar to Unity devs, stronger IDE tooling', value: 'csharp' },
            { name: 'Both — GDScript for gameplay/UI, C# for performance systems', value: 'both' },
        ],
    });
    return answer;
}
/* ── config operations ─────────────────────────── */
function readCODESQUADMd(targetPath) {
    const p = join(targetPath, 'CODESQUAD.md');
    return existsSync(p) ? readFileSync(p, 'utf-8') : null;
}
function updateCODESQUADMd(targetPath, engine, version) {
    const p = join(targetPath, 'CODESQUAD.md');
    const content = existsSync(p) ? readFileSync(p, 'utf-8') : '';
    const techStack = ENGINE_TECH_STACK[engine]?.replace('[version]', version)
        ?? `- **Engine**: ${engine} ${version}`;
    // Replace Technology Stack section placeholder or add it
    const techPattern = /## Technology Stack\n\n[\s\S]*?(?=\n## |\n$)/;
    const newSection = `## Technology Stack\n\n${techStack}`;
    let updated;
    if (techPattern.test(content)) {
        updated = content.replace(techPattern, newSection);
    }
    else {
        // Insert after the project description or at end
        const descEnd = content.indexOf('## Technology Stack');
        if (descEnd !== -1) {
            updated = content.replace(/## Technology Stack[\s\S]*?(?=\n## |\n$)/, newSection);
        }
        else {
            updated = content + '\n\n' + newSection + '\n';
        }
    }
    // Update the engine reference import
    const importPattern = /@docs\/engine-reference\/[\w-]+\/VERSION\.md/;
    const newImport = `@docs/engine-reference/${engine}/VERSION.md`;
    if (importPattern.test(updated)) {
        updated = updated.replace(importPattern, newImport);
    }
    writeFileSync(p, updated, 'utf-8');
    logger.success('Updated CODESQUAD.md');
}
function updateProjectConfig(targetPath, engine, version) {
    const p = join(targetPath, 'codesquad.config.yaml');
    let config = { version: 1, tools: [], engine: { name: engine, version } };
    if (existsSync(p)) {
        try {
            const raw = readFileSync(p, 'utf-8');
            config = parseYaml(raw);
        }
        catch { /* use defaults */ }
    }
    config.engine = { name: engine, version };
    const yaml = `# CodeSquad Project Configuration
version: ${config.version ?? 1}
tools:
${(config.tools ?? []).map((t) => `  - ${t}`).join('\n') || '  # - codebuddy'}
engine:
  name: ${engine}
  version: "${version}"
generation:
  overwriteOnUpdate: true
  skipSettings: false
`;
    writeFileSync(p, yaml, 'utf-8');
    logger.success('Updated codesquad.config.yaml');
}
/* ── engine reference doc ──────────────────────── */
function generateVersionDoc(targetPath, engine, version) {
    const baseDir = join(targetPath, 'docs', 'engine-reference', engine);
    mkdirSync(baseDir, { recursive: true });
    const today = new Date().toISOString().split('T')[0];
    const riskLevel = estimateRisk(version);
    const riskLabel = riskLevel === 'LOW' ? 'LOW — version is within LLM training data'
        : riskLevel === 'MEDIUM' ? 'MEDIUM — version is near LLM training data edge'
            : 'HIGH — version is beyond LLM training data';
    const content = `# ${ENGINE_META[engine]?.display ?? engine} — Version Reference

| Field | Value |
|-------|-------|
| **Engine Version** | ${version} |
| **Project Pinned** | ${today} |
| **LLM Knowledge Cutoff** | May 2025 |
| **Risk Level** | ${riskLabel} |

## Note

This engine version is ${riskLevel === 'LOW' ? 'within the LLM\'s training data' : riskLevel === 'MEDIUM' ? 'near the edge of LLM training data' : 'beyond the LLM\'s training data'}.
${riskLevel === 'LOW'
        ? 'Engine reference docs are optional but can be added later.'
        : 'Consider running `codesquad setup-engine refresh` to populate full reference docs from the web.'}

Run \`codesquad setup-engine refresh\` to update reference docs at any time.
`;
    writeFileSync(join(baseDir, 'VERSION.md'), content, 'utf-8');
    logger.success(`Created docs/engine-reference/${engine}/VERSION.md`);
}
function estimateRisk(version) {
    // Simple heuristic based on version numbers
    const parts = version.split('.');
    const major = parseInt(parts[0] ?? '0') || 0;
    const minor = parseInt(parts[1] ?? '0') || 0;
    // Known approximate cutoffs:
    // Godot: 4.3, Unity: 6000.x, Unreal: 5.4, Cocos: 3.8
    if (major < 4)
        return 'LOW'; // older versions definitely in training data
    // Actually, let's be permissive — most versions around 2025 are LOW or MEDIUM
    if (major < 5 || (version.startsWith('3') && !version.startsWith('4')))
        return 'LOW';
    return 'MEDIUM';
}
/* ── directories & gitignore ───────────────────── */
function createEngineDirs(targetPath, engine) {
    const dirs = ENGINE_DIRS[engine];
    if (!dirs) {
        logger.info('No engine-specific directory template for this engine.');
        return;
    }
    let count = 0;
    for (const dir of dirs) {
        const fullPath = join(targetPath, dir);
        if (!existsSync(fullPath)) {
            mkdirSync(fullPath, { recursive: true });
            count++;
        }
    }
    if (count > 0) {
        logger.success(`Created ${count} engine-specific directories (${engine})`);
    }
    else {
        logger.info('Engine directories already exist.');
    }
    // Append engine-specific gitignore
    const giRules = ENGINE_GITIGNORE[engine];
    if (giRules) {
        const giPath = join(targetPath, '.gitignore');
        const giContent = existsSync(giPath) ? readFileSync(giPath, 'utf-8') : '';
        // Only append if not already present
        const marker = `# ${ENGINE_META[engine]?.display ?? engine}`;
        if (!giContent.includes(marker)) {
            appendFileSync(giPath, '\n' + marker + '\n' + giRules + '\n', 'utf-8');
            logger.success('Updated .gitignore with engine-specific rules');
        }
    }
}
/* ── technical preferences ─────────────────────── */
function generateTechPrefs(targetPath, engine) {
    const p = join(targetPath, 'docs', 'technical-preferences.md');
    const today = new Date().toISOString().split('T')[0];
    let naming;
    switch (engine) {
        case 'godot':
            naming = '- Classes: PascalCase\n- Variables/functions: snake_case\n- Signals: snake_case past tense\n- Files: snake_case\n- Scenes: PascalCase\n- Constants: UPPER_SNAKE_CASE';
            break;
        case 'unity':
            naming = '- Classes: PascalCase\n- Public fields: PascalCase\n- Private fields: _camelCase\n- Methods: PascalCase\n- Files: PascalCase matching class\n- Constants: PascalCase or UPPER_SNAKE_CASE';
            break;
        case 'unreal':
            naming = '- Classes: Prefixed PascalCase (A/U/F prefix)\n- Variables: PascalCase\n- Functions: PascalCase\n- Booleans: b prefix (bIsAlive)\n- Files: Match class without prefix';
            break;
        case 'cocos':
            naming = '- Classes/Components: PascalCase\n- Properties: camelCase\n- Methods: camelCase\n- Private: _camelCase\n- Files: camelCase\n- Constants: UPPER_SNAKE_CASE';
            break;
        default:
            naming = '## Naming Conventions\n\n[TBD]';
    }
    const content = `# Technical Preferences
# Generated: ${today}

## Engine & Language

${ENGINE_TECH_STACK[engine] ?? `- **Engine**: ${engine}`}

## Naming Conventions

${naming}

## Input & Platform

- **Target Platforms**: [TO BE CONFIGURED]
- **Input Methods**: [TO BE CONFIGURED]
- **Primary Input**: [TO BE CONFIGURED]

## Performance Budgets

[TO BE CONFIGURED]

## Testing

[TO BE CONFIGURED]

## Forbidden Patterns

[TO BE CONFIGURED]

## Allowed Libraries

[TO BE CONFIGURED]
`;
    writeFileSync(p, content, 'utf-8');
    logger.success('Created docs/technical-preferences.md');
}
/* ── main entry ────────────────────────────────── */
export async function runSetupEngine(options = {}) {
    const targetPath = resolve(options.targetPath || '.');
    logger.title('CodeSquad Setup Engine');
    // Parse arguments
    let engine = (options.engine ?? '').toLowerCase();
    let version = options.version ?? '';
    // Validate engine name
    const validEngines = ['godot', 'unity', 'unreal', 'cocos', 'custom'];
    if (engine && !validEngines.includes(engine)) {
        logger.error(`Unknown engine: ${engine}. Supported: godot, unity, unreal, cocos, custom`);
        return;
    }
    // Guided selection if no engine specified
    if (!engine) {
        engine = await selectEngine();
        if (engine === 'custom') {
            logger.info('Custom engine selected. Only basic config will be written.');
        }
    }
    // Ask for version
    if (!version) {
        version = await askVersion();
    }
    // Godot language selection
    let language = '';
    if (engine === 'godot') {
        const lang = await askGodotLang();
        language = lang;
    }
    else {
        language = ENGINE_META[engine]?.defaultLang ?? '';
    }
    // Show summary
    console.log();
    logger.info(`Engine:   ${chalk.green(ENGINE_META[engine]?.display ?? engine)}`);
    logger.info(`Version:  ${chalk.green(version)}`);
    if (language) {
        logger.info(`Language: ${chalk.green(language)}`);
    }
    // Confirm
    const confirm = await select({
        message: 'Proceed with these settings?',
        choices: [
            { name: 'Yes, configure engine', value: 'yes' },
            { name: 'No, cancel', value: 'no' },
        ],
    });
    if (confirm !== 'yes') {
        logger.info('Cancelled.');
        return;
    }
    console.log();
    // 1. Update project config
    updateProjectConfig(targetPath, engine, version);
    // 2. Generate engine reference doc
    generateVersionDoc(targetPath, engine, version);
    // 3. Create engine-specific directories
    createEngineDirs(targetPath, engine);
    // 4. Update CODESQUAD.md
    const codesquadExists = existsSync(join(targetPath, 'CODESQUAD.md'));
    if (codesquadExists) {
        updateCODESQUADMd(targetPath, engine, version);
    }
    else {
        logger.info('CODESQUAD.md not found — skipping update.');
    }
    // 5. Generate technical preferences if missing
    const techPrefsPath = join(targetPath, 'docs', 'technical-preferences.md');
    if (!existsSync(techPrefsPath)) {
        const createPrefs = await select({
            message: 'Create technical-preferences.md with engine defaults?',
            choices: [
                { name: 'Yes, create with defaults', value: 'yes' },
                { name: 'Skip for now', value: 'no' },
            ],
        });
        if (createPrefs === 'yes') {
            generateTechPrefs(targetPath, engine);
        }
    }
    // Summary
    console.log();
    logger.title('Engine Setup Complete');
    console.log(chalk.green(`Engine:          ${ENGINE_META[engine]?.display ?? engine} ${version}`));
    console.log(chalk.green(`Language:        ${language || 'N/A'}`));
    console.log(chalk.green(`Reference Docs:  docs/engine-reference/${engine}/VERSION.md`));
    console.log();
    console.log(chalk.dim('Next Steps:'));
    console.log(chalk.dim(`  1. Review docs/engine-reference/${engine}/VERSION.md`));
    console.log(chalk.dim('  2. Verify the engine directory structure'));
    console.log(chalk.dim('  3. Run `codesquad repl` then type `/brainstorm` to discover your game concept'));
}
//# sourceMappingURL=setup-engine-core.js.map