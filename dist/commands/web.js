/**
 * codesquad web — Start the Web Console.
 *
 * Usage: codesquad web [options]
 */
import { startWebServer } from '../web/server.js';
import chalk from 'chalk';
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
// In Bun compile mode, import.meta.url is not a file:// URL.
// Fall back to process.cwd()/../../AICore for embedded mode.
const _resolveRoot = () => {
    try {
        const __dirname = fileURLToPath(new URL('.', import.meta.url));
        return resolve(__dirname, '..', '..');
    }
    catch {
        return resolve(process.cwd(), '..', '..');
    }
};
const PKG_ROOT = _resolveRoot();
const AICORE_DIR = join(PKG_ROOT, 'AICore');
/**
 * Create missing project directories (non-destructive).
 * AICore/ stays in CLI installation only — NOT copied to user projects.
 */
function scaffoldProject(cwd) {
    // ── .codesquad/settings.json — copy from AICore template ──
    const codesquadDir = join(cwd, '.codesquad');
    const targetSettings = join(codesquadDir, 'settings.json');
    if (!existsSync(targetSettings)) {
        const sourceSettings = join(AICORE_DIR, 'settings.json');
        if (existsSync(sourceSettings)) {
            try {
                mkdirSync(codesquadDir, { recursive: true });
                copyFileSync(sourceSettings, targetSettings);
                console.log(chalk.green(`  ✅ Created .codesquad/settings.json`));
            }
            catch (err) {
                console.log(chalk.yellow(`  ⚠ Failed to copy settings.json: ${err.message}`));
            }
        }
    }
    else {
        console.log(chalk.dim(`  📂 .codesquad/settings.json already exists — skipping`));
    }
    // ── design/ — create minimal structure ──
    const designDir = join(cwd, 'design');
    if (!existsSync(designDir)) {
        mkdirSync(join(designDir, 'gdd'), { recursive: true });
        mkdirSync(join(designDir, 'registry'), { recursive: true });
        console.log(chalk.green(`  ✅ Created design/ (gdd/, registry/)`));
    }
    else {
        console.log(chalk.dim(`  📂 design/ already exists — skipping`));
    }
    // ── production/ — create minimal structure ──
    const prodDir = join(cwd, 'production');
    if (!existsSync(prodDir)) {
        mkdirSync(join(prodDir, 'sprints'), { recursive: true });
        mkdirSync(join(prodDir, 'milestones'), { recursive: true });
        mkdirSync(join(prodDir, 'session-logs'), { recursive: true });
        mkdirSync(join(prodDir, 'session-state'), { recursive: true });
        console.log(chalk.green(`  ✅ Created production/ (sprints/, milestones/, session-logs/, session-state/)`));
    }
    else {
        console.log(chalk.dim(`  📂 production/ already exists — skipping`));
    }
    // ── tests/ — create minimal structure ──
    const testsDir = join(cwd, 'tests');
    if (!existsSync(testsDir)) {
        mkdirSync(join(testsDir, 'unit'), { recursive: true });
        mkdirSync(join(testsDir, 'integration'), { recursive: true });
        console.log(chalk.green(`  ✅ Created tests/ (unit/, integration/)`));
    }
    else {
        console.log(chalk.dim(`  📂 tests/ already exists — skipping`));
    }
}
/** Validate a bind address is a safe IP/hostname (no shell metacharacters). */
function isValidBind(bind) {
    // Allow: IPv4, IPv6, localhost, simple hostnames (alphanumeric + hyphen + dot)
    return /^[a-zA-Z0-9.\-:]+$/.test(bind) && bind.length > 0 && bind.length < 256;
}
export async function handleWeb(options = {}) {
    const port = options.port ?? 9099;
    const bind = options.bind ?? '127.0.0.1';
    if (!isValidBind(bind)) {
        console.error(chalk.red(`  Invalid bind address: "${bind}". Use a valid IP or hostname.`));
        process.exit(1);
    }
    // 确保当前目录为工作目录
    const cwd = process.cwd();
    console.log(chalk.dim(`  📁 Working directory: ${cwd}`));
    // 检查工作目录下有没有 ".codesquad" 目录，没有就创建一个
    const codesquadDir = join(cwd, '.codesquad');
    if (!existsSync(codesquadDir)) {
        console.log(chalk.dim(`  📂 Creating .codesquad directory...`));
        mkdirSync(codesquadDir, { recursive: true });
        console.log(chalk.green(`  ✅ Created .codesquad directory`));
    }
    else {
        console.log(chalk.dim(`  📂 .codesquad directory already exists`));
    }
    // ── Scaffold project directories (non-destructive) ──
    scaffoldProject(cwd);
    console.log();
    const { server, token } = await startWebServer({
        port,
        bind,
        authToken: options.token,
        noAuth: options.noAuth ?? false,
        readonly: options.readonly ?? false,
        open: false,
    });
    // Display startup info
    console.log(chalk.cyan('  ╔══════════════════════════════════════════════╗'));
    console.log(chalk.cyan('  ║       CodeSquad Web Console                  ║'));
    console.log(chalk.cyan('  ╚══════════════════════════════════════════════╝'));
    console.log();
    const baseUrl = `http://${bind === '0.0.0.0' ? 'localhost' : bind}:${port}`;
    let openUrl;
    if (!options.noAuth) {
        const loginUrl = `http://${bind === '0.0.0.0' ? 'localhost' : bind}:${port}/login?token=${token}`;
        console.log(`  ${chalk.green('✅')} Server started on ${chalk.bold(baseUrl)}`);
        console.log(`  ${chalk.dim('🔑')} Login URL: ${chalk.underline(loginUrl)}`);
        console.log(`  ${chalk.dim('ℹ️')}  Token: ${token.slice(0, 8)}...${token.slice(-8)} (valid for this session)`);
        openUrl = loginUrl;
    }
    else {
        console.log(`  ${chalk.yellow('⚠️')}  Auth disabled — anyone can access the API`);
        console.log(`  ${chalk.green('✅')} Server started on ${chalk.bold(baseUrl)}`);
        openUrl = baseUrl;
    }
    // 默认使用系统浏览器打开 URL
    try {
        const { exec } = await import('child_process');
        if (process.platform === 'win32') {
            // start "" "url" — 空标题避免 Windows 误把 URL 当窗口标题
            exec(`start "" "${openUrl}"`);
        }
        else if (process.platform === 'darwin') {
            exec(`open "${openUrl}"`);
        }
        else {
            exec(`xdg-open "${openUrl}"`);
        }
        console.log(`  ${chalk.green('✅')} Browser opened`);
    }
    catch {
        console.log(`  ${chalk.yellow('⚠️')}  Could not open browser automatically`);
    }
    console.log();
    console.log(`  ${chalk.dim('Press Ctrl+C to stop')}`);
    console.log();
    // Graceful shutdown
    const shutdown = () => {
        console.log(chalk.dim('\n  Shutting down...'));
        server.close(() => {
            process.exit(0);
        });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
}
//# sourceMappingURL=web.js.map