/**
 * Status Line — project stage detection + context usage display + config-based execution.
 *
 * Replicates AICore/statusline.sh logic in TypeScript for REPL integration.
 * Shows: ctx% | model | stage [| Epic > Feature > Task]
 *
 * Feature 7 (P4): Supports external script execution with JSON input.
 *
 * Phase 7.2
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
function detectStage(projectRoot) {
    // Priority 1: Explicit stage file
    const stageFile = join(projectRoot, 'production', 'stage.txt');
    if (existsSync(stageFile)) {
        try {
            const stage = readFileSync(stageFile, 'utf-8').split('\n')[0]?.trim();
            if (stage && STAGES.has(stage)) {
                return stage;
            }
        }
        catch { /* fall through */ }
    }
    // Priority 2: Auto-detect from artifacts
    const concept = join(projectRoot, 'design', 'gdd', 'game-concept.md');
    const systems = join(projectRoot, 'design', 'gdd', 'systems-index.md');
    const techPrefs = join(projectRoot, '.codebuddy', 'docs', 'technical-preferences.md');
    const srcDir = join(projectRoot, 'src');
    const adrDir = join(projectRoot, 'docs', 'architecture');
    const hasConcept = existsSync(concept);
    const hasSystems = existsSync(systems);
    const hasAdrs = existsSync(adrDir) && readdirSync(adrDir).some((f) => f.startsWith('adr-'));
    // Check if engine is configured
    let engineConfigured = false;
    if (existsSync(techPrefs)) {
        try {
            const content = readFileSync(techPrefs, 'utf-8');
            const match = content.match(/\*\*Engine\*\*:\s*(.+)/);
            engineConfigured = !!(match && !match[1]?.includes('TO BE CONFIGURED'));
        }
        catch { /* nop */ }
    }
    // Count source files
    let srcCount = 0;
    if (existsSync(srcDir)) {
        try {
            const exts = ['.ts', '.tsx', '.js', '.gd', '.cs', '.cpp', '.h', '.py', '.rs', '.lua'];
            srcCount = readdirSync(srcDir, { recursive: true })
                .filter((f) => exts.some((ext) => String(f).endsWith(ext))).length;
        }
        catch { /* nop */ }
    }
    // Determine stage (most-advanced first)
    if (srcCount >= 10)
        return 'Production';
    if (hasAdrs)
        return 'Pre-Production';
    if (engineConfigured)
        return 'Technical Setup';
    if (hasSystems)
        return 'Systems Design';
    if (hasConcept)
        return 'Concept';
    return 'Concept';
}
const STAGES = new Set(['Concept', 'Systems Design', 'Technical Setup', 'Pre-Production', 'Production']);
// ── Breadcrumb Detection ──
function detectBreadcrumb(projectRoot, stage) {
    if (stage !== 'Production' && stage !== 'Polish' && stage !== 'Release')
        return '';
    const stateFile = join(projectRoot, 'production', 'session-state', 'active.md');
    if (!existsSync(stateFile))
        return '';
    try {
        const content = readFileSync(stateFile, 'utf-8');
        const statusMatch = content.match(/<!-- STATUS -->([\s\S]*?)<!-- \/STATUS -->/);
        if (!statusMatch)
            return '';
        let epic = '', feature = '', task = '';
        for (const line of statusMatch[1].split('\n')) {
            if (line.startsWith('Epic:'))
                epic = line.replace('Epic:', '').trim();
            if (line.startsWith('Feature:'))
                feature = line.replace('Feature:', '').trim();
            if (line.startsWith('Task:'))
                task = line.replace('Task:', '').trim();
        }
        const parts = [epic, feature, task].filter(Boolean).join(' > ');
        return parts ? ` | ${parts}` : '';
    }
    catch {
        return '';
    }
}
// ── Feature 7 (P4): Config-based script execution ──
/**
 * Load status line configuration from AICore/settings.json.
 * Supports external shell command execution with JSON input.
 */
export function loadStatusLineConfig(aicoreDir) {
    const settingsPath = join(aicoreDir, 'settings.json');
    if (!existsSync(settingsPath))
        return null;
    try {
        const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
        const sl = settings.statusLine;
        if (sl && sl.type === 'command' && sl.command) {
            return {
                type: 'command',
                command: sl.command,
                padding: sl.padding,
            };
        }
        return null;
    }
    catch {
        return null;
    }
}
/**
 * Execute the status line script and return rendered text.
 * Passes JSON input via stdin, captures stdout with 5s timeout.
 */
export function executeStatusLineScript(config, input) {
    try {
        const result = execSync(config.command, {
            timeout: 5000,
            input: JSON.stringify(input),
            encoding: 'utf-8',
            windowsHide: true,
        });
        return result.trim() || null;
    }
    catch {
        // Silent failure — status line is cosmetic
        return null;
    }
}
/**
 * Build status line JSON input for external script.
 */
export function buildStatusLineInput(status) {
    const pkg = readPkgVersion();
    return {
        model: { id: status.model, display_name: status.model },
        workspace: { current_dir: process.cwd(), project_dir: process.cwd() },
        cost: { total_cost_usd: status.totalCost?.toFixed(4) || '0.0000', total_duration_ms: 0 },
        context_window: status.contextWindow || { tokens: 0, usage_percent: 0 },
        version: pkg,
        output_style: 'default',
    };
}
function readPkgVersion() {
    try {
        const pkgPath = join(process.cwd(), 'package.json');
        return JSON.parse(readFileSync(pkgPath, 'utf-8')).version || '0.1.0';
    }
    catch {
        return '0.1.0';
    }
}
// ── Main ──
export function getStatusLine(projectRoot, model, contextPercent, totalCost, contextWindow) {
    const stage = detectStage(projectRoot);
    const breadcrumb = detectBreadcrumb(projectRoot, stage);
    return {
        contextPercent,
        model,
        stage,
        breadcrumb,
        totalCost,
        contextWindow,
    };
}
export function formatStatusLine(status) {
    const ctx = status.contextPercent !== null
        ? `ctx: ${status.contextPercent}%`
        : 'ctx: --';
    return `${ctx} | ${status.model} | ${status.stage}${status.breadcrumb}`;
}
/** Stage symbol for display. */
export function stageSymbol(stage) {
    switch (stage) {
        case 'Concept': return '💡';
        case 'Systems Design': return '📐';
        case 'Technical Setup': return '⚙️';
        case 'Pre-Production': return '🔧';
        case 'Production': return '🚀';
        default: return '📋';
    }
}
// ── Debounced Refresh (Feature 7, P4) ──
let _debounceTimer = null;
let _lastRendered = '';
const DEBOUNCE_MS = 300;
/**
 * Refresh the status line with debounce.
 * Call after every agent response to show updated context usage.
 *
 * Mirrors Claude Code: StatusLine.tsx uses React's useEffect + setInterval
 * for periodic refresh. We simulate with a debounced callback.
 */
export function scheduleStatusLineRefresh(renderFn, projectRoot, model, contextPercent) {
    if (_debounceTimer) {
        clearTimeout(_debounceTimer);
        _debounceTimer = null;
    }
    // Immediate first render on zero-to-value transition
    const status = getStatusLine(projectRoot, model, contextPercent);
    const text = formatStatusLine(status);
    if (text !== _lastRendered) {
        _lastRendered = text;
        renderFn(text);
    }
    // Schedule debounced re-render
    _debounceTimer = setTimeout(() => {
        const refreshed = getStatusLine(projectRoot, model, contextPercent);
        const refreshedText = formatStatusLine(refreshed);
        if (refreshedText !== _lastRendered) {
            _lastRendered = refreshedText;
            renderFn(refreshedText);
        }
        _debounceTimer = null;
    }, DEBOUNCE_MS);
}
/** Cancel any pending status line refresh. */
export function cancelStatusLineRefresh() {
    if (_debounceTimer) {
        clearTimeout(_debounceTimer);
        _debounceTimer = null;
    }
}
//# sourceMappingURL=statusline.js.map