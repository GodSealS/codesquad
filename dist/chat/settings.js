/**
 * User settings management.
 *
 * Stores persistent user preferences in ~/.codesquad/config.json.
 * Phase 8.1: Cross-chat memory limit configuration.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { codesquadHome } from './storage.js';
// ── Defaults ──
const DEFAULTS = {
    memoryLimitChats: 5,
    hasCraftConfirmed: false,
    streamingEnabled: false,
};
const MIN_MEMORY_LIMIT = 2;
const MAX_MEMORY_LIMIT = 15;
// ── Paths ──
function configDir() {
    const dir = codesquadHome();
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    return dir;
}
function configPath() {
    return join(configDir(), 'config.json');
}
// ── Load / Save ──
/** Load user settings, merging with defaults for missing fields. */
export function loadSettings() {
    const path = configPath();
    if (!existsSync(path))
        return { ...DEFAULTS };
    try {
        const raw = readFileSync(path, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
            memoryLimitChats: clampMemoryLimit(parsed.memoryLimitChats ?? DEFAULTS.memoryLimitChats),
            hasCraftConfirmed: parsed.hasCraftConfirmed ?? DEFAULTS.hasCraftConfirmed,
            streamingEnabled: parsed.streamingEnabled ?? DEFAULTS.streamingEnabled,
        };
    }
    catch {
        return { ...DEFAULTS };
    }
}
/** Save a partial update, validate ranges, and persist to disk. */
export function saveSettings(partial) {
    const current = loadSettings();
    const merged = {
        ...current,
        ...partial,
    };
    // Validate and clamp
    if ('memoryLimitChats' in partial) {
        merged.memoryLimitChats = clampMemoryLimit(merged.memoryLimitChats);
    }
    // configDir() already ensures the directory exists
    configDir();
    writeFileSync(configPath(), JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
}
/** Shortcut to get the current memory limit. */
export function getMemoryLimit() {
    return loadSettings().memoryLimitChats;
}
// ── Helpers ──
function clampMemoryLimit(n) {
    const num = Math.round(n);
    if (num < MIN_MEMORY_LIMIT)
        return MIN_MEMORY_LIMIT;
    if (num > MAX_MEMORY_LIMIT)
        return MAX_MEMORY_LIMIT;
    return num;
}
//# sourceMappingURL=settings.js.map