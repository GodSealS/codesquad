/**
 * Hook registry — external registration into AICore/hooks/ (user-level).
 *
 * Pattern: graphify hook install/uninstall
 * - Copies hook script to AICore/hooks/
 * - Updates AICore/settings.json → hooks.SessionStart to register the command
 * - Unregister reverses both operations
 */
import { existsSync, readdirSync, copyFileSync, mkdirSync, unlinkSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getUserCategoryDir } from './paths.js';
import { ensureManifest, addEntriesToManifest, removeEntriesFromManifest } from './manifest.js';
const HOOK_EXTENSIONS = ['.sh', '.ps1', '.bat', '.cmd', '.py', '.js'];
export function scanHookDir(dir) {
    if (!existsSync(dir))
        return [];
    try {
        return readdirSync(dir)
            .filter(f => HOOK_EXTENSIONS.some(ext => f.endsWith(ext)))
            .map(f => ({ name: f.replace(/\.[^.]+$/, ''), filePath: join(dir, f) }));
    }
    catch {
        return [];
    }
}
/** Add a hook command to AICore/settings.json → hooks.SessionStart. */
function addHookToSettings(aicoreRoot, command) {
    const settingsPath = join(aicoreRoot, 'settings.json');
    let settings = {};
    if (existsSync(settingsPath)) {
        try {
            settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
        }
        catch { /* start fresh */ }
    }
    settings.hooks = settings.hooks || {};
    settings.hooks.SessionStart = settings.hooks.SessionStart || [];
    // Check if command already registered
    const exists = settings.hooks.SessionStart.some((entry) => (entry.hooks || []).some((h) => h.command === command));
    if (exists)
        return;
    // Add new matcher entry
    settings.hooks.SessionStart.push({
        matcher: '',
        hooks: [{ type: 'command', command, timeout: 30 }],
    });
    mkdirSync(join(aicoreRoot), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}
/** Remove a hook command from AICore/settings.json. */
function removeHookFromSettings(aicoreRoot, command) {
    const settingsPath = join(aicoreRoot, 'settings.json');
    if (!existsSync(settingsPath))
        return;
    let settings;
    try {
        settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    }
    catch {
        return;
    }
    if (!settings.hooks?.SessionStart)
        return;
    // Remove matcher entries whose hooks contain this command
    settings.hooks.SessionStart = settings.hooks.SessionStart
        .map((entry) => ({
        ...entry,
        hooks: (entry.hooks || []).filter((h) => h.command !== command),
    }))
        .filter((entry) => (entry.hooks || []).length > 0);
    // Clean up empty SessionStart
    if (settings.hooks.SessionStart.length === 0) {
        delete settings.hooks.SessionStart;
    }
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}
/** Build the expected settings.json command for a registered hook name. */
function getHookSettingsCommand(name, ext) {
    const relPath = `AICore/hooks/${name}${ext}`;
    if (ext === '.ps1')
        return `powershell -File ${relPath}`;
    if (ext === '.bat' || ext === '.cmd')
        return relPath;
    if (ext === '.py')
        return `python ${relPath}`;
    if (ext === '.js')
        return `node ${relPath}`;
    return `bash ${relPath}`;
}
export function registerHookFile(aicoreRoot, sourcePath, sourceName) {
    if (!existsSync(sourcePath))
        return `Hook file not found: ${sourcePath}`;
    const base = sourcePath.replace(/^.*[/\\]/, '');
    if (!HOOK_EXTENSIONS.some(ext => base.endsWith(ext)))
        return `Unrecognized hook extension: ${base}. Supported: ${HOOK_EXTENSIONS.join(', ')}`;
    const name = base.replace(/\.[^.]+$/, '');
    const ext = base.match(/\.[^.]+$/)?.[0] ?? '.sh';
    const destDir = getUserCategoryDir(aicoreRoot, 'hook');
    mkdirSync(destDir, { recursive: true });
    try {
        const destPath = join(destDir, `${name}${ext}`);
        copyFileSync(sourcePath, destPath);
        // Add to settings.json
        addHookToSettings(aicoreRoot, getHookSettingsCommand(name, ext));
        // Track in manifest
        addEntriesToManifest(aicoreRoot, [{
                name, category: 'hook', source: 'external',
                externalSource: sourceName, registeredAt: new Date().toISOString(), sourcePath: destPath,
            }]);
        return { name };
    }
    catch (err) {
        return `Failed to copy hook: ${err.message}`;
    }
}
export function registerHookDir(aicoreRoot, sourceDir, sourceName) {
    const result = { count: 0, updated: 0, skipped: 0, errors: [] };
    const destDir = getUserCategoryDir(aicoreRoot, 'hook');
    mkdirSync(destDir, { recursive: true });
    for (const { name, filePath } of scanHookDir(sourceDir)) {
        try {
            const ext = filePath.match(/\.[^.]+$/)?.[0] ?? '.sh';
            const destPath = join(destDir, `${name}${ext}`);
            const existed = existsSync(destPath);
            copyFileSync(filePath, destPath);
            result.count++;
            if (existed)
                result.updated++;
            // Add to settings.json
            addHookToSettings(aicoreRoot, getHookSettingsCommand(name, ext));
            addEntriesToManifest(aicoreRoot, [{
                    name, category: 'hook', source: 'external',
                    externalSource: sourceName, registeredAt: new Date().toISOString(), sourcePath: destPath,
                }]);
        }
        catch (err) {
            result.errors.push(`Hook ${name}: ${err.message}`);
        }
    }
    return result;
}
export function listRegisteredHooks(aicoreRoot) {
    return ensureManifest(aicoreRoot).entries.filter(e => e.category === 'hook');
}
export function unregisterHook(aicoreRoot, name) {
    const dir = getUserCategoryDir(aicoreRoot, 'hook');
    for (const ext of HOOK_EXTENSIONS) {
        const fp = join(dir, `${name}${ext}`);
        if (existsSync(fp)) {
            try {
                // Remove from settings.json first
                removeHookFromSettings(aicoreRoot, getHookSettingsCommand(name, ext));
                // Delete file
                unlinkSync(fp);
                removeEntriesFromManifest(aicoreRoot, 'hook', [name]);
                return true;
            }
            catch {
                return false;
            }
        }
    }
    return false;
}
//# sourceMappingURL=hook-registry.js.map