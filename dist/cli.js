/**
 * CodeSquad CLI — unified entry point with dual-mode support.
 *
 * Usage:
 *   codesquad                  → start interactive REPL
 *   codesquad --serve [port]   → start HTTP API server
 *   codesquad --help           → show help
 *   codesquad --version        → show version
 *
 * The API server and REPL share the same Node process and core modules.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
// ── Simple flag parser (P3.2 will enhance this) ──
function parseSimpleFlags(argv) {
    const flags = { help: false, version: false };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--help' || argv[i] === '-h')
            flags.help = true;
        if (argv[i] === '--version' || argv[i] === '-v')
            flags.version = true;
        if (argv[i] === '--serve') {
            const next = argv[i + 1];
            flags.serve = next && !next.startsWith('--') ? parseInt(next, 10) || 9090 : 9090;
            if (next && !next.startsWith('--'))
                i++;
        }
    }
    return flags;
}
// ── Main ──
async function main() {
    const flags = parseSimpleFlags(process.argv.slice(2));
    // --version
    if (flags.version) {
        const pkgPath = join(__dirname, '..', 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        console.log(`CodeSquad v${pkg.version}`);
        process.exit(0);
    }
    // --help
    if (flags.help) {
        console.log([
            'CodeSquad — Multi-Agent Game Studio CLI',
            '',
            'Usage:',
            '  codesquad                  Start interactive REPL',
            '  codesquad --serve [port]   Start HTTP API server (default port 9090)',
            '  codesquad --help            Show this help',
            '  codesquad --version         Show version',
            '',
            'Environment:',
            '  ANTHROPIC_API_KEY          Anthropic API key',
            '  OPENAI_API_KEY             OpenAI API key',
            '  DEEPSEEK_API_KEY           DeepSeek API key',
            '  CODESQUAD_API_TOKEN        API server auth token (optional)',
            '',
        ].join('\n'));
        process.exit(0);
    }
    const AICORE_DIR = join(__dirname, '..', '.codesquad');
    const PROJECT_ROOT = join(__dirname, '..');
    // ── Mode: API Server ──
    if (flags.serve) {
        const { startApiServer, setApiState } = await import('./api/server.js');
        const { loadAllAgentsLayered } = await import('./agents/definition.js');
        const { setAicodeRoot } = await import('./repl/skill-registry.js');
        const { registerTools, registerTool } = await import('./tools/registry.js');
        const { initHooksFromCodesquad } = await import('./hooks/config-loader.js');
        const { loadBuiltinPermissionRules } = await import('./permissions/pipeline.js');
        const { loadCodesquadConfig } = await import('./config/aicore-config.js');
        // Minimal bootstrap (same as REPL init)
        const { setProjectRoot } = await import('./chat/storage.js');
        const { setUsageProjectRoot } = await import('./llm/usage-tracker.js');
        const { initDiskCache } = await import('./cache/disk-cache.js');
        const { initAgentInstanceManager } = await import('./agents/instance-manager.js');
        setAicodeRoot(AICORE_DIR);
        setProjectRoot(PROJECT_ROOT);
        initDiskCache(PROJECT_ROOT);
        initAgentInstanceManager();
        setUsageProjectRoot(PROJECT_ROOT);
        registerTools([]);
        initHooksFromCodesquad(AICORE_DIR);
        loadCodesquadConfig(AICORE_DIR);
        loadBuiltinPermissionRules();
        loadAllAgentsLayered(AICORE_DIR);
        setApiState({ providerId: 'anthropic', modelId: 'claude-sonnet-4-20250514' });
        // Register core tools for API use
        const { BashTool } = await import('./tools/BashTool.js');
        const { FileReadTool } = await import('./tools/FileReadTool.js');
        const { FileWriteTool } = await import('./tools/FileWriteTool.js');
        const { FileEditTool } = await import('./tools/FileEditTool.js');
        const { GrepTool, GlobTool } = await import('./tools/GrepGlobTool.js');
        const { AgentTool } = await import('./tools/AgentTool.js');
        const { TodoWriteTool } = await import('./tools/TodoWriteTool.js');
        const { SkillTool } = await import('./tools/SkillTool.js');
        const { ToolSearchTool } = await import('./tools/ToolSearchTool.js');
        registerTools([BashTool, FileReadTool, FileWriteTool, FileEditTool, GrepTool, GlobTool, AgentTool, TodoWriteTool, SkillTool, ToolSearchTool]);
        await startApiServer({
            port: flags.serve,
            host: '127.0.0.1',
            aicoreDir: AICORE_DIR,
            projectRoot: PROJECT_ROOT,
            corsOrigins: ['http://localhost:5173'],
        });
        // Keep process alive
        process.on('SIGINT', () => { console.log('\n[API] Shutting down...'); process.exit(0); });
        process.on('SIGTERM', () => { console.log('\n[API] Shutting down...'); process.exit(0); });
        return;
    }
    // ── Mode: REPL (default) ──
    const { startRepl } = await import('./repl/index.js');
    await startRepl();
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map