/**
 * AICore rules loader — path-matched rule injection.
 *
 * Scans AICore/rules/*.md, extracts path patterns from frontmatter,
 * and injects matching rules when tools interact with files.
 *
 * References:
 *   Claude Code src/utils/claudemd.ts — getConditionalRulesForCwdLevelDirectory()
 *
 * Phase 5.0
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getCodeSquadProjectCategory, getCodeSquadUserCategory, readAicoreFile, readAicoreDir } from '../core/paths.js';
import { virtualExists, virtualReadDir, virtualReadFile } from '../embedded/virtual-fs.js';
// ── Cache ──
let _rules = null;
// ── Loader ──
/**
 * Load all rules from a single directory.
 */
export function loadAllRules(rulesDir) {
    if (_rules)
        return _rules;
    const rules = [];
    try {
        const files = readdirSync(rulesDir).filter((f) => f.endsWith('.md'));
        for (const file of files) {
            const filePath = join(rulesDir, file);
            try {
                const raw = readFileSync(filePath, 'utf-8');
                const parsed = parseRuleFile(raw, file.replace('.md', ''));
                if (parsed) {
                    rules.push(parsed);
                }
            }
            catch {
                // Skip unreadable rules
            }
        }
    }
    catch {
        // Rules directory may not exist
    }
    _rules = rules;
    return rules;
}
/**
 * Load rules from two layers (Project .codesquad/ > User AICore/).
 * Override semantics: same-named rule from project wins.
 */
export function loadAllRulesLayered(aicoreRoot, cwd) {
    if (_rules)
        return _rules;
    const seen = new Map();
    const layerDirs = [
        { dir: join(aicoreRoot, 'rules'), layer: 'user' },
        { dir: getCodeSquadUserCategory('rules'), layer: 'user' },
        { dir: getCodeSquadProjectCategory('rules', cwd), layer: 'project' },
    ];
    for (let i = 0; i < layerDirs.length; i++) {
        const { dir, layer } = layerDirs[i];
        // ── Layer 0 (AICore built-in): use readAicoreDir/readAicoreFile (VirtualFS) ──
        if (i === 0) {
            const entries = readAicoreDir('rules').filter((e) => e.endsWith('.md'));
            for (const file of entries) {
                const raw = readAicoreFile(`rules/${file}`);
                if (!raw)
                    continue;
                const name = file.replace('.md', '');
                try {
                    const parsed = parseRuleFile(raw, name);
                    if (parsed) {
                        seen.set(name, { ...parsed, layer });
                    }
                }
                catch {
                    // Skip unreadable
                }
            }
            continue;
        }
        // ── Dev mode / disk layers ──
        try {
            const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
            for (const file of files) {
                const filePath = join(dir, file);
                try {
                    const raw = readFileSync(filePath, 'utf-8');
                    const name = file.replace('.md', '');
                    const parsed = parseRuleFile(raw, name);
                    if (parsed) {
                        const withLayer = { ...parsed, layer };
                        seen.set(name, withLayer); // Later layers override
                    }
                }
                catch {
                    // Skip unreadable
                }
            }
        }
        catch {
            // Directory may not exist
        }
    }
    _rules = Array.from(seen.values());
    return _rules;
}
/**
 * Parse a rule Markdown file.
 * Expected format:
 *   ---
 *   paths:
 *     - "src/core/**"
 *     - "src/gameplay/**"
 *   ---
 *   # Rule content...
 */
function parseRuleFile(raw, name) {
    const paths = [];
    // Extract YAML frontmatter
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
        const fm = fmMatch[1];
        // Parse paths: list (like YAML list)
        const pathLines = fm.match(/paths:\s*\n((?:\s*-\s*[^\n]+\n?)*)/);
        if (pathLines) {
            const items = pathLines[1].matchAll(/-\s*["']?([^"'\n]+)["']?/g);
            for (const item of items) {
                if (item[1]) {
                    paths.push(item[1].trim());
                }
            }
        }
        // Also support single path: "src/**"
        const singlePath = fm.match(/paths?:\s*["']?([^"'\n]+)["']?/);
        if (singlePath && paths.length === 0) {
            paths.push(singlePath[1].trim());
        }
    }
    // If no paths found, the rule applies to everything
    if (paths.length === 0) {
        paths.push('**/*');
    }
    // Content = body after frontmatter
    const content = fmMatch ? raw.slice(raw.indexOf('---\n', 4) + 4).trim() : raw;
    return { name, paths, content };
}
// ── Matching ──
/**
 * Find rules that match a given file path.
 * Compares each rule's path patterns against the file path.
 */
export function findMatchingRules(filePath, rulesDir) {
    const rules = loadAllRules(rulesDir);
    const normalized = filePath.replace(/\\/g, '/');
    return rules.filter((rule) => {
        return rule.paths.some((pattern) => matchPath(normalized, pattern));
    });
}
/**
 * Simple glob matching for path patterns.
 *
 * Supports:
 *   - ** matches any depth
 *   - * matches within a single path segment
 *   - src/** matches all files under src/
 *   - *.ts matches .ts files
 */
function matchPath(filePath, pattern) {
    // Normalize pattern
    const normalizedPattern = pattern.replace(/\\/g, '/');
    // Convert glob to regex
    const regexStr = normalizedPattern
        .replace(/\*\*/g, '__DOUBLE_STAR__')
        .replace(/\*/g, '[^/]*')
        .replace(/__DOUBLE_STAR__/g, '.*')
        .replace(/\?/g, '.')
        .replace(/\./g, '\\.');
    const regex = new RegExp(`(^|.*\/)${regexStr}$`);
    return regex.test(filePath) || regex.test(filePath.split('/').pop() || '');
}
// ── Format for Injection ──
/**
 * Format matching rules for injection into context.
 */
export function formatRulesForContext(rules) {
    if (rules.length === 0)
        return '';
    const lines = ['## 适用规则 (AICore Rules)'];
    for (const rule of rules) {
        lines.push('');
        lines.push(`### Rule: ${rule.name}`);
        lines.push(`Matches: ${rule.paths.join(', ')}`);
        lines.push('');
        lines.push(rule.content);
        lines.push('');
    }
    return lines.join('\n');
}
/**
 * Find rules matching a file path and return formatted context.
 */
export function getRulesContext(filePath, rulesDir) {
    const matching = findMatchingRules(filePath, rulesDir);
    return formatRulesForContext(matching);
}
// ── Injection into Tool Context ──
/**
 * When writing/editing a file, check if rules apply.
 * Returns context text to inject, or empty string.
 */
export function getRulesForFileOperation(filePath, rulesDir) {
    try {
        return getRulesContext(filePath, rulesDir);
    }
    catch {
        return '';
    }
}
/** Invalidate the rules cache. */
export function invalidateRulesCache() {
    _rules = null;
}
// ── Session-Level Rules (Phase P3.5) ──
/**
 * Load rules that should be injected at session start.
 * Unlike path-matched rules (which fire on file access),
 * these are always visible to the agent.
 *
 * Rules matching:
 *   - Files starting with ALWAYS_ prefix → session-level
 *   - Files NOT starting with PATH_ and containing no path separators in name → session-level
 *
 * Loads from all three layers (Project > User > AICore), with later layers overriding.
 */
export function loadSessionRules(aicoreDir) {
    const seen = new Map();
    const layerDirs = [
        join(aicoreDir, 'rules'), // AICore (built-in)
        getCodeSquadUserCategory('rules'), // ~/.codesquad/ (user-home)
        getCodeSquadProjectCategory('rules'), // Project-level
    ];
    for (let idx = 0; idx < layerDirs.length; idx++) {
        const dir = layerDirs[idx];
        // Layer 0 (AICore): use VirtualFS. Layers 1-2: use real filesystem.
        const useVirtual = idx === 0;
        const dirExists = useVirtual ? virtualExists(dir) : existsSync(dir);
        if (!dirExists)
            continue;
        let allRules;
        try {
            allRules = (useVirtual ? virtualReadDir(dir) : readdirSync(dir))
                .filter((f) => f.endsWith('.md'));
        }
        catch {
            continue;
        }
        const alwaysRules = allRules.filter((f) => {
            const name = f.replace('.md', '');
            return name.startsWith('ALWAYS_') || (!name.includes('/') && !name.startsWith('PATH_'));
        });
        for (const f of alwaysRules) {
            const content = useVirtual
                ? virtualReadFile(join(dir, f), 'utf-8')
                : readFileSync(join(dir, f), 'utf-8');
            seen.set(f.replace('.md', ''), `[Rule: ${f.replace('.md', '')}]\n${content}`);
        }
    }
    return Array.from(seen.values());
}
//# sourceMappingURL=loader.js.map