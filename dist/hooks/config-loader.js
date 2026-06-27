/**
 * Hook configuration loader — reads hooks from two layers.
 *
 * Layers: Project (.codesquad/) > User (AICore/)
 *
 * Phase 2.4
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { loadHooksConfig, registerHook } from './executor.js';
import { getCodeSquadProjectCategory, getCodeSquadUserCategory, CODESQUAD_USER_SETTINGS } from '../core/paths.js';
import { virtualExists, virtualReadFile } from '../embedded/virtual-fs.js';
// ── Load from AICore/settings.json ──
/**
 * Load hooks configuration from AICore/settings.json.
 * Returns the parsed HooksSettings, or null if not found.
 */
export function loadHooksFromAICore(aicoreDir) {
    const settingsPath = join(aicoreDir, 'settings.json');
    if (!virtualExists(settingsPath))
        return null;
    try {
        const raw = virtualReadFile(settingsPath, 'utf-8');
        const settings = JSON.parse(raw);
        if (!settings.hooks || typeof settings.hooks !== 'object')
            return null;
        // Validate and transform hook config format
        const hooks = {};
        for (const [eventName, matchers] of Object.entries(settings.hooks)) {
            if (!Array.isArray(matchers))
                continue;
            const configs = [];
            for (const matcher of matchers) {
                const hookList = Array.isArray(matcher.hooks) ? matcher.hooks : [];
                const validHooks = hookList.map((h) => ({
                    type: h.type || 'command',
                    command: h.command,
                    prompt: h.prompt,
                    timeout: typeof h.timeout === 'number' ? h.timeout : undefined,
                    if: h.if,
                    once: h.once,
                    async: h.async,
                }));
                configs.push({
                    matcher: matcher.matcher || '',
                    hooks: validHooks,
                });
            }
            hooks[eventName] = configs;
        }
        return hooks;
    }
    catch {
        return null;
    }
}
/**
 * Load hooks configuration from layered settings.json files.
 * Merges: AICore/settings.json → .codesquad/settings.json
 * Later layers override earlier ones for matching events.
 */
export function loadHooksFromLayered(aicoreDir, cwd) {
    const merged = {};
    const sources = [
        join(aicoreDir, 'settings.json'), // AICore (built-in)
        CODESQUAD_USER_SETTINGS, // ~/.codesquad/ (user-home)
        join(getCodeSquadProjectCategory('hooks', cwd), '..', 'settings.json'), // .codesquad/ (project-level)
    ];
    for (let i = 0; i < sources.length; i++) {
        const settingsPath = sources[i];
        // ── Layer 0 (AICore built-in): use VirtualFS for embedded support ──
        if (i === 0) {
            if (!virtualExists(settingsPath))
                continue;
            try {
                const raw = virtualReadFile(settingsPath, 'utf-8');
                const settings = JSON.parse(raw);
                if (!settings.hooks || typeof settings.hooks !== 'object')
                    continue;
                for (const [eventName, matchers] of Object.entries(settings.hooks)) {
                    if (!Array.isArray(matchers))
                        continue;
                    const configs = parseHookMatchers(matchers);
                    merged[eventName] = configs;
                }
            }
            catch { /* skip */ }
            continue;
        }
        // ── Dev mode / disk layers ──
        if (!existsSync(settingsPath))
            continue;
        try {
            const raw = readFileSync(settingsPath, 'utf-8');
            const settings = JSON.parse(raw);
            if (!settings.hooks || typeof settings.hooks !== 'object')
                continue;
            for (const [eventName, matchers] of Object.entries(settings.hooks)) {
                if (!Array.isArray(matchers))
                    continue;
                merged[eventName] = parseHookMatchers(matchers);
            }
        }
        catch {
            // Skip unreadable settings
        }
    }
    return merged;
}
/** Parse hook matchers array into HookConfig array. */
function parseHookMatchers(matchers) {
    const configs = [];
    for (const matcher of matchers) {
        const hookList = Array.isArray(matcher.hooks) ? matcher.hooks : [];
        const validHooks = hookList.map((h) => ({
            type: h.type || 'command',
            command: h.command,
            prompt: h.prompt,
            timeout: typeof h.timeout === 'number' ? h.timeout : undefined,
            if: h.if,
            once: h.once,
            async: h.async,
        }));
        configs.push({
            matcher: matcher.matcher || '',
            hooks: validHooks,
        });
    }
    return configs;
}
/**
 * Initialize hooks system from AICore configuration.
 * Call once at REPL startup.
 * Now supports layered loading (AICore + User + Project).
 */
export function initHooksFromAICore(aicoreDir, cwd) {
    const config = loadHooksFromLayered(aicoreDir, cwd);
    if (Object.keys(config).length > 0) {
        loadHooksConfig(config);
    }
    else {
        // Fallback: just AICore
        const aicoreConfig = loadHooksFromAICore(aicoreDir);
        if (aicoreConfig) {
            loadHooksConfig(aicoreConfig);
        }
    }
    // Also scan for loose hook scripts in user-level and project-level hook dirs
    scanAndRegisterLooseHooks();
}
/**
 * Scan project-level hook directory for loose scripts and register as SessionStart hooks.
 */
function scanAndRegisterLooseHooks() {
    // Layer 1: ~/.codesquad/hooks/ (user-home)
    if (existsSync(getCodeSquadUserCategory('hooks')))
        registerLooseScripts(getCodeSquadUserCategory('hooks'));
    // Layer 2: ${project}/.codesquad/hooks/ (project-level)
    const projectDir = getCodeSquadProjectCategory('hooks');
    if (existsSync(projectDir))
        registerLooseScripts(projectDir);
}
function registerLooseScripts(dir) {
    try {
        const files = readdirSync(dir).filter((f) => f.endsWith('.sh') || f.endsWith('.ps1') || f.endsWith('.bat'));
        if (files.length === 0)
            return;
        const defaultShell = process.platform === 'win32' ? 'powershell' : 'bash';
        for (const f of files) {
            const ext = f.match(/\.[^.]+$/)?.[0] ?? '';
            let command;
            if (ext === '.ps1') {
                command = `powershell -File ${join(dir, f)}`;
            }
            else if (ext === '.bat' || ext === '.cmd') {
                command = join(dir, f);
            }
            else {
                command = `${defaultShell} ${join(dir, f)}`;
            }
            registerHook('SessionStart', {
                matcher: '',
                hooks: [{ type: 'command', command, timeout: 30 }],
            });
        }
    }
    catch {
        // Skip
    }
}
//# sourceMappingURL=config-loader.js.map