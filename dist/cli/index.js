import { Command } from 'commander';
import chalk from 'chalk';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'node:fs';
import { handleInit } from '../commands/init.js';
import { handleUpdate } from '../commands/update.js';
import { handleSetupEngine } from '../commands/setup-engine.js';
import { handleValidate } from '../commands/validate.js';
import { handleVersion } from '../commands/version.js';
import { handleCheck } from '../commands/check.js';
import { handleBackup } from '../commands/backup.js';
import { handleCreate, handleCreateSpec } from '../commands/create.js';
import { handleRegister } from '../commands/register.js';
import { handleMcpStdio } from '../commands/mcp.js';
import { handleBuild, getBuildInfoJson } from '../commands/build.js';
import { handleTest } from '../commands/test.js';
import { enableDebugMode } from '../utils/debug.js';
/** Read package.json version, with embedded mode fallback. */
async function getPkgVersion() {
    // Bun compiled mode: read from embedded data
    if (!import.meta.url.startsWith('file://')) {
        try {
            const runtime = await import('../embedded/runtime.js');
            const raw = runtime.readEmbeddedFile('package.json');
            if (raw)
                return JSON.parse(raw);
        }
        catch { /* fall through */ }
    }
    // Dev mode / npm: read from disk — try multiple path depths
    const __dirname = dirname(fileURLToPath(import.meta.url));
    for (const depth of ['..', '../..']) {
        const pkgPath = join(__dirname, depth, 'package.json');
        try {
            return JSON.parse(readFileSync(pkgPath, 'utf-8'));
        }
        catch { /* try next depth */ }
    }
    return { version: '0.1.0' };
}
/**
 * Normalize argv for Commander.js.
 *
 * When running through tsx/wrappers, process.argv contains extra path entries:
 *   tsx:  [node, tsx/dist/cli.mjs, src/cli/index.ts, --help]
 *   bin:  [node, bin/codesquad.js, --help]
 *
 * This strips 1–2 intermediate runner/script path entries and injects
 * 'codesquad' as the program name so Commander sees clean args.
 */
function normalizeArgv(argv) {
    const isPathLike = (s) => s !== undefined && (/[/\\]/.test(s) || /\.(ts|js|mjs|cjs)$/i.test(s));
    // If argv[1] is already a clean program name (not a path), nothing to fix
    if (!isPathLike(argv[1]))
        return argv;
    // argv[1] is a runner path — skip it
    let i = 2;
    // If argv[2] is also a script file path, skip that too
    if (isPathLike(argv[i]))
        i++;
    return [argv[0] ?? 'node', 'codesquad', ...argv.slice(i)];
}
export async function run(argv = process.argv) {
    // Normalize argv to strip tsx/wrapper path prefixes
    argv = normalizeArgv(argv);
    const pkg = await getPkgVersion();
    const program = new Command();
    program
        .name('codesquad')
        .description(chalk.bold('CodeSquad CLI — AI-native game development toolchain'))
        .version(pkg.version)
        .option('-d, --debug', 'Enable debug mode (verbose logs + anomaly detection)', () => {
        enableDebugMode();
    })
        .addHelpText('beforeAll', chalk.cyan(`
 ╔══════════════════════════════════════╗
 ║     ${chalk.bold.yellow('CodeSquad CLI')}                     ║
 ║     Game Studio Agent Architecture    ║
 ╚══════════════════════════════════════╝
`))
        .addHelpText('after', `
${chalk.dim('Commands:')}
  ${chalk.green('repl')}         Start the interactive Terminal REPL
  ${chalk.green('serve')}        Start HTTP API server (UI bridge)
  ${chalk.green('init')}         Initialize CodeSquad in a project
  ${chalk.green('update')}       Regenerate agent/skill files
  ${chalk.green('start')}        Guided onboarding wizard
  ${chalk.green('bind')}         Manage AI tool bindings
  ${chalk.green('config')}       Manage model and project configuration
  ${chalk.green('create')}       Scaffold a new agent or skill
  ${chalk.green('register')}     Register external agents/skills/rules/hooks
  ${chalk.green('validate')}     Run static checks and coverage reports
  ${chalk.green('check')}        Validate agent/skill definition integrity
  ${chalk.green('version')}      Show version and check for updates
  ${chalk.green('setup-engine')} Configure game engine
  ${chalk.green('build')}        Build/compile the game project (detects engine)
  ${chalk.green('test')}         Run tests (detects test framework)
  ${chalk.green('engine')}       Detect and display game engine info

${chalk.dim('Examples:')}
  $ codesquad repl
  $ codesquad serve --port 9090
  $ codesquad init --tools codebuddy,claude
  $ codesquad start
  $ codesquad bind --add codex
  $ codesquad register agent ./my-agents --source my-plugin
  $ codesquad register list
  $ codesquad config set agent.game-designer "claude-sonnet"
  $ codesquad config import my-models.yaml
  $ codesquad build              # auto-detect and show build commands
  $ codesquad build unreal       # show UE build commands
  $ codesquad test               # auto-detect and show test commands
  $ codesquad test --coverage    # show test command with coverage
  $ codesquad engine             # show detected engine info

${chalk.dim('Storage:')}
  User-level registry: ${chalk.dim('.codesquad/ (built-in)')}
  External registration: ${chalk.dim('codesquad register agent <path>')}
  Project-level: ${chalk.dim('<project>/.codesquad/')} (project-specific overrides)
  Data stored under ${chalk.dim('<project>/.codesquad/')} (project-scoped)
  Override with ${chalk.dim('CODESQUAD_HOME')} env var
  Cross-project memory: https://github.com/EverMind-AI/EverOS (future)`);
    // ── init ───────────────────────────────────────
    program
        .command('init [path]')
        .description('Initialize CodeSquad in a project')
        .option('--tools <tools>', 'Comma-separated tool list (e.g., codebuddy,claude,codex)')
        .option('--force', 'Force overwrite existing files')
        .action(async (targetPath, options) => {
        await handleInit(targetPath, options);
    });
    // ── update ─────────────────────────────────────
    program
        .command('update [path]')
        .description('Regenerate agent/skill files for bound tools')
        .option('--tools <tools>', 'Target specific tools')
        .option('--force', 'Force overwrite all files')
        .option('--preserve', 'Preserve user-modified files')
        .option('--dry-run', 'Preview changes without writing')
        .option('--diff', 'Show per-file change summary')
        .action(async (targetPath, options) => {
        await handleUpdate(targetPath, options);
    });
    // ── start ──────────────────────────────────────
    program
        .command('start')
        .description('Guided onboarding — detect project state and set up')
        .option('--ci', 'Non-interactive mode (skip prompts)')
        .action(async (options) => {
        const { handleStart } = await import('../commands/start.js');
        await handleStart('.', options);
    });
    // ── bind ───────────────────────────────────────
    program
        .command('bind')
        .description('Manage AI tool bindings — add, remove, or list')
        .option('--add <tool>', 'Add a tool binding and generate files')
        .option('--remove <tool>', 'Remove a tool binding and clean up files')
        .option('--list', 'List currently bound tools')
        .action(async (options) => {
        const { handleBind } = await import('../commands/bind.js');
        await handleBind('.', {
            add: options?.add,
            remove: options?.remove,
            list: options?.list ?? (!options?.add && !options?.remove),
        });
    });
    // ── config ─────────────────────────────────────
    program
        .command('config <action> [args...]')
        .description('Manage model and project configuration')
        .allowUnknownOption()
        .action(async (action, _args, _opts, cmd) => {
        const { handleConfig } = await import('../commands/config.js');
        await handleConfig(action, _opts, cmd);
    });
    // ── validate ────────────────────────────────────
    program
        .command('validate [subcommand]')
        .description('Run static checks and coverage reports on skills and agents')
        .option('--all', 'Run on all skills (for static subcommand)')
        .option('--fail-on-warn', 'Treat warnings as failures (for CI mode)')
        .option('--strict', 'Strict mode (for project subcommand)')
        .argument('[name]', 'Skill or agent name')
        .action(async (subcommand, name, opts) => {
        // B9 fix: when subcommand is not a known subcommand and name is missing,
        // treat subcommand as a skill/agent name for the 'static' subcommand.
        const KNOWN_SUBCOMMANDS = new Set(['static', 'audit', 'ci', 'project', 'category', 'spec']);
        if (subcommand && !KNOWN_SUBCOMMANDS.has(subcommand) && !name) {
            name = subcommand;
            subcommand = 'static';
        }
        await handleValidate(subcommand ?? '', { all: opts?.all, name, failOnWarn: opts?.failOnWarn, strict: opts?.strict });
    });
    // ── version ──────────────────────────────────────
    program
        .command('version')
        .description('Show version info and check for updates')
        .option('--check', 'Check npm registry for newer version')
        .option('--json', 'Output in JSON format')
        .action(async (options) => {
        await handleVersion(options ?? {});
    });
    // ── check ─────────────────────────────────────────
    program
        .command('check')
        .description('Validate local agent/skill definition integrity')
        .option('--agents', 'Check only agent definitions')
        .option('--skills', 'Check only skill definitions')
        .option('--stubs', 'Check .codesquad stub vs .codebuddy consistency (Phase 9.3)')
        .option('--verbose', 'Show detailed output for each file')
        .action(async (options) => {
        await handleCheck(options ?? {});
    });
    // ── backup ────────────────────────────────────────
    program
        .command('backup')
        .description('Manage local backups of agent/skill definitions')
        .option('--list', 'List all backups')
        .action(async (options) => {
        await handleBackup('backup', { list: options?.list });
    });
    program
        .command('restore')
        .description('Restore agent/skill definitions from backup')
        .option('--id <id>', 'Backup ID to restore')
        .option('--latest', 'Restore the latest backup')
        .action(async (options) => {
        await handleBackup('restore', { id: options?.id, latest: options?.latest });
    });
    // ── create ─────────────────────────────────────────
    program
        .command('create <type> [subType] [name]')
        .description('Scaffold a new agent, skill, or test spec')
        .action(async (type, subType, name) => {
        if (type === 'spec') {
            // codesquad create spec agent <name>  →  subType=agent, name=<name>
            // codesquad create spec skill <name>  →  subType=skill, name=<name>
            await handleCreateSpec((subType ?? 'agent'), name);
        }
        else {
            // codesquad create agent <name>  →  type=agent, name=subType
            await handleCreate(type, subType);
        }
    });
    // ── register ───────────────────────────────────────
    program
        .command('register <action> [args...]')
        .description('Register external agents, skills, rules, or hooks into .codesquad/ (user-level)')
        .option('--source <name>', 'External source identifier')
        .action(async (action, args, options) => {
        await handleRegister(action, args, options);
    });
    // ── mcp ────────────────────────────────────────
    program
        .command('mcp [mode]')
        .description('Start the CodeSquad MCP Server')
        .option('--port <port>', 'HTTP port (for serve mode)', '9090')
        .option('--auth-token <token>', 'Auth token for HTTP mode')
        .option('--output <dir>', 'Output directory (for convert-stubs mode)')
        .action(async (mode, options) => {
        const modeStr = mode ?? 'stdio';
        switch (modeStr) {
            case 'stdio':
                handleMcpStdio();
                break;
            case 'serve':
                const { handleMcpServe } = await import('../commands/mcp.js');
                await handleMcpServe('.', { port: options?.port ? parseInt(options.port) : 9090, authToken: options?.authToken });
                break;
            case 'status':
                const { handleMcpStatus } = await import('../commands/mcp.js');
                handleMcpStatus();
                break;
            case 'logs':
                const { handleMcpLogs } = await import('../commands/mcp.js');
                handleMcpLogs();
                break;
            case 'metrics':
                const { handleMcpMetrics } = await import('../commands/mcp.js');
                handleMcpMetrics();
                break;
            case 'convert-stubs':
                const { handleConvertStubs } = await import('../commands/mcp.js');
                handleConvertStubs(options?.output);
                break;
            default:
                console.error(`Unknown mode: ${modeStr}. Use: stdio | serve | status | logs | metrics | convert-stubs`);
                process.exit(1);
        }
    });
    // ── setup-engine ───────────────────────────────
    program
        .command('setup-engine')
        .description('Configure game engine and generate reference docs')
        .argument('[engine]', 'Engine name (godot, unity, unreal, cocos)')
        .argument('[version]', 'Engine version')
        .action(async (engine, version) => {
        await handleSetupEngine(engine, version);
    });
    // ── build ────────────────────────────────────────
    program
        .command('build [engine]')
        .description('Build/compile the game project (detects engine automatically)')
        .option('--platform <platform>', 'Target platform (Win64, Android, iOS, Web)')
        .option('--config <config>', 'Build configuration (Development, Shipping, Debug)')
        .option('--dry-run', 'Show suggested build commands without running')
        .option('--json', 'Output engine/build info as JSON')
        .action(async (engine, options) => {
        if (options?.json) {
            const json = await getBuildInfoJson(engine);
            console.log(json);
            return;
        }
        await handleBuild(engine, {
            platform: options?.platform,
            config: options?.config,
            dryRun: options?.dryRun,
        });
    });
    // ── test ─────────────────────────────────────────
    program
        .command('test')
        .description('Run tests (detects test framework automatically)')
        .option('--watch', 'Run in watch mode')
        .option('--coverage', 'Run with coverage collection')
        .option('--filter <pattern>', 'Filter tests by name pattern')
        .option('--dry-run', 'Show suggested test command without running')
        .option('--json', 'Output test framework info as JSON')
        .action(async (options) => {
        await handleTest({
            watch: options?.watch,
            coverage: options?.coverage,
            filter: options?.filter,
            dryRun: options?.dryRun,
            json: options?.json,
        });
    });
    // ── engine ───────────────────────────────────────
    program
        .command('engine')
        .description('Detect and display game engine information for this project')
        .option('--json', 'Output as JSON')
        .action(async (options) => {
        const { detectEngine } = await import('../engine/detector.js');
        const info = await detectEngine(process.cwd());
        if (options?.json) {
            console.log(JSON.stringify(info, null, 2));
        }
        else {
            console.log(`Engine: ${info.engine}`);
            if (info.version)
                console.log(`Version: ${info.version}`);
            if (info.projectFile)
                console.log(`Project file: ${info.projectFile}`);
            console.log(`Confidence: ${(info.confidence * 100).toFixed(0)}%`);
        }
    });
    // ── repl ───────────────────────────────────────
    program
        .command('repl')
        .description('Start the CodeSquad Terminal REPL')
        .option('--no-color', 'Disable colored output')
        .option('--system-prompt <text>', 'Override the system prompt (replaces built-in sections)')
        .option('--permission-mode <mode>', 'Start with a specific permission mode (default|acceptEdits|bypassPermissions|plan)', 'default')
        .option('--mcp-config <path>', 'Path to MCP server configuration file (YAML or JSON)')
        .option('--model <model>', 'Default model to use (e.g., anthropic/claude-sonnet-4-20250514)')
        .option('--sandbox', 'Enable sandbox mode (restrict Bash commands)')
        .action(async (options) => {
        const { startRepl } = await import('../repl/index.js');
        // Pass CLI options via environment (simple IPC for single-process REPL)
        if (options?.systemPrompt)
            process.env.CODESQUAD_SYSTEM_PROMPT = options.systemPrompt;
        if (options?.permissionMode)
            process.env.CODESQUAD_PERMISSION_MODE = options.permissionMode;
        if (options?.mcpConfig)
            process.env.CODESQUAD_MCP_CONFIG = options.mcpConfig;
        if (options?.model)
            process.env.CODESQUAD_DEFAULT_MODEL = options.model;
        if (options?.sandbox)
            process.env.CODESQUAD_SANDBOX = '1';
        await startRepl();
    });
    // ── web ───────────────────────────────────────
    program
        .command('web')
        .description('Start the CodeSquad Web Console (auto-opens browser)')
        .option('--port <port>', 'HTTP port', '9099')
        .option('--bind <addr>', 'Bind address', '127.0.0.1')
        .option('--token <token>', 'Static auth token')
        .option('--no-auth', 'Disable authentication')
        .option('--readonly', 'Read-only mode')
        .action(async (options) => {
        const { handleWeb } = await import('../commands/web.js');
        // Commander's --no-auth maps to options.auth = false (negated boolean)
        await handleWeb({
            port: options?.port ? parseInt(options.port) : 9099,
            bind: options?.bind ?? '127.0.0.1',
            token: options?.token,
            noAuth: options?.auth === false,
            readonly: options?.readonly,
        });
    });
    // ── serve ───────────────────────────────────── (Phase P2.9 — API bridge for UI)
    program
        .command('serve')
        .description('Start the CodeSquad HTTP API server (for UI bridge)')
        .option('--port <port>', 'HTTP port', '9090')
        .option('--bind <addr>', 'Bind address', '127.0.0.1')
        .action(async (options) => {
        const port = options?.port ? parseInt(options.port) : 9090;
        const bind = options?.bind ?? '127.0.0.1';
        const __dir = dirname(fileURLToPath(import.meta.url));
        const PROJECT_ROOT = join(__dir, '..', '..');
        const AICORE_DIR = join(PROJECT_ROOT, '.codesquad');
        // Bootstrap (same as REPL init)
        const { startApiServer, setApiState } = await import('../api/server.js');
        const { setAicodeRoot } = await import('../repl/skill-registry.js');
        const { registerTools } = await import('../tools/registry.js');
        const { initHooksFromCodesquad } = await import('../hooks/config-loader.js');
        const { loadCodesquadConfig } = await import('../config/aicore-config.js');
        const { loadAllAgents, loadAllAgentsLayered } = await import('../agents/definition.js');
        const { setProjectRoot } = await import('../chat/storage.js');
        const { setUsageProjectRoot } = await import('../llm/usage-tracker.js');
        const { initDiskCache } = await import('../cache/disk-cache.js');
        const { initAgentInstanceManager } = await import('../agents/instance-manager.js');
        setAicodeRoot(AICORE_DIR);
        setProjectRoot(PROJECT_ROOT);
        initDiskCache(PROJECT_ROOT);
        initAgentInstanceManager();
        setUsageProjectRoot(PROJECT_ROOT);
        registerTools([]);
        initHooksFromCodesquad(AICORE_DIR);
        loadCodesquadConfig(AICORE_DIR);
        loadAllAgentsLayered(AICORE_DIR);
        // Resolve provider from env
        const providerId = process.env.CODESQUAD_DEFAULT_MODEL?.split('/')[0] || 'anthropic';
        const modelId = process.env.CODESQUAD_DEFAULT_MODEL?.split('/')[1] || 'claude-sonnet-4-20250514';
        setApiState({ providerId, modelId });
        // Register core tools
        const { BashTool } = await import('../tools/BashTool.js');
        const { FileReadTool } = await import('../tools/FileReadTool.js');
        const { FileWriteTool } = await import('../tools/FileWriteTool.js');
        const { FileEditTool } = await import('../tools/FileEditTool.js');
        const { GrepTool, GlobTool } = await import('../tools/GrepGlobTool.js');
        const { AgentTool } = await import('../tools/AgentTool.js');
        const { TodoWriteTool } = await import('../tools/TodoWriteTool.js');
        const { SkillTool } = await import('../tools/SkillTool.js');
        const { ToolSearchTool } = await import('../tools/ToolSearchTool.js');
        registerTools([BashTool, FileReadTool, FileWriteTool, FileEditTool, GrepTool, GlobTool, AgentTool, TodoWriteTool, SkillTool, ToolSearchTool]);
        await startApiServer({
            port,
            host: bind,
            aicoreDir: AICORE_DIR,
            projectRoot: PROJECT_ROOT,
            corsOrigins: ['http://localhost:5173'],
        });
        process.on('SIGINT', () => { console.log('\n[API] Shutting down...'); process.exit(0); });
        process.on('SIGTERM', () => { console.log('\n[API] Shutting down...'); process.exit(0); });
    });
    return program.parseAsync(argv);
}
//# sourceMappingURL=index.js.map