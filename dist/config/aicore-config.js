/**
 * .codesquad config loader — loads .codesquad/settings.json into the permission pipeline.
 *
 * References:
 *   Claude Code src/Config/ (config loading)
 *
 * Phase 5.5 — Chat Feature Gap Fill
 */
import { join } from 'path';
import { loadBuiltinPermissionRules, appendPermissionRules } from '../permissions/pipeline.js';
import { loadSandboxConfig } from '../permissions/sandbox.js';
import { virtualExists, virtualReadFile } from '../embedded/virtual-fs.js';
// ── Loader ──
/**
 * Load and apply all .codesquad settings from settings.json.
 *
 * Handles:
 *   - permissions.allow[] / deny[] / ask[] → registered as permission rules
 *   - sandbox.* → applied to sandbox config
 *
 * @param codesquadDir - Path to the .codesquad directory
 * @returns true if settings.json was loaded, false if not found
 */
export function loadCodesquadConfig(codesquadDir) {
    const settingsPath = join(codesquadDir, 'settings.json');
    if (!virtualExists(settingsPath)) {
        return false;
    }
    let settings;
    try {
        const raw = virtualReadFile(settingsPath, 'utf-8');
        settings = JSON.parse(raw);
    }
    catch (err) {
        console.error(`[codesquad-config] Failed to parse ${settingsPath}: ${err.message}`);
        return false;
    }
    // ── 1. Load built-in defaults first ──
    loadBuiltinPermissionRules();
    // ── 2. Append permissions from settings.json ──
    if (settings.permissions) {
        const allowRules = parseRuleArray(settings.permissions.allow, 'allow');
        const denyRules = parseRuleArray(settings.permissions.deny, 'deny');
        const askRules = parseRuleArray(settings.permissions.ask, 'ask');
        appendPermissionRules(allowRules, denyRules, askRules);
    }
    // ── 3. Load sandbox config ──
    if (settings.sandbox) {
        loadSandboxConfig(settings.sandbox);
    }
    return true;
}
// ── Rule Parser ──
/**
 * Parse array of permission rule strings into ResolvedPermissionRule[].
 *
 * Supports formats:
 *   - "Bash"                          → tool-level rule
 *   - "Bash(git *)"                   → content-pattern rule
 *   - "Read(*.ts)"                    → path-pattern rule
 *   - "Write(*.env*)"                 → path-pattern deny
 */
function parseRuleArray(rules, behavior, source = 'settings.json') {
    if (!rules || rules.length === 0)
        return [];
    const result = [];
    for (const rule of rules) {
        const parsed = parseSingleRule(rule);
        if (parsed) {
            result.push({
                toolName: parsed.toolName,
                behavior,
                source,
                contentPattern: parsed.contentPattern,
            });
        }
    }
    return result;
}
function parseSingleRule(rule) {
    // Format: "ToolName(content pattern)"
    const parenMatch = rule.match(/^(\w[\w-]*)\s*\((.+)\)$/);
    if (parenMatch) {
        return { toolName: parenMatch[1], contentPattern: parenMatch[2] };
    }
    // Format: "ToolName"
    const simpleMatch = rule.match(/^(\w[\w-]*)$/);
    if (simpleMatch) {
        return { toolName: simpleMatch[1] };
    }
    // Unparseable rule — skip silently
    return null;
}
//# sourceMappingURL=aicore-config.js.map