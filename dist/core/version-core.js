/**
 * version-core — CLI version info & npm registry check
 *
 * Phase 7.1: Reads package.json for version, counts agents/skills/templates,
 * optionally checks npm registry for newer versions.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { AICORE_AGENTS_DIR, AICORE_SKILLS_DIR, CLI_PACKAGE_JSON, CLI_TEMPLATES_DIR } from './paths.js';
// ── Paths ──────────────────────────────────────────────
function getPackagePath() {
    // Resolve from the codesquad package itself
    return CLI_PACKAGE_JSON;
}
// ── Version Info ───────────────────────────────────────
/**
 * Count agent definition files in a directory.
 * Excludes manifest.yaml and non-markdown files (e.g. manifest.yaml, README.md).
 */
function countAgentFiles(dirPath) {
    try {
        if (!existsSync(dirPath))
            return 0;
        return readdirSync(dirPath, { withFileTypes: true })
            .filter((d) => d.isFile() && d.name.endsWith('.md') && d.name !== 'manifest.yaml')
            .length;
    }
    catch {
        return 0;
    }
}
function countDirs(dirPath) {
    try {
        if (!existsSync(dirPath))
            return 0;
        return readdirSync(dirPath, { withFileTypes: true })
            .filter((d) => d.isDirectory() && d.name !== 'manifest.yaml')
            .length;
    }
    catch {
        return 0;
    }
}
function countTemplateFiles() {
    try {
        const templatesDir = CLI_TEMPLATES_DIR;
        if (!existsSync(templatesDir))
            return 0;
        let count = 0;
        function walk(dir) {
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const e of entries) {
                if (e.isFile())
                    count++;
                else if (e.isDirectory())
                    walk(join(dir, e.name));
            }
        }
        walk(templatesDir);
        return count;
    }
    catch {
        return 0;
    }
}
/**
 * Get version info about the installed CLI.
 */
export function getVersionInfo() {
    const pkgPath = getPackagePath();
    let cliVersion = 'unknown';
    if (existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            cliVersion = pkg.version ?? 'unknown';
        }
        catch { /* keep default */ }
    }
    const agentsDir = AICORE_AGENTS_DIR;
    const skillsDir = AICORE_SKILLS_DIR;
    return {
        cliVersion,
        agentCount: countAgentFiles(agentsDir),
        skillCount: countDirs(skillsDir),
        templateCount: countTemplateFiles(),
        nodeVersion: process.version,
    };
}
// ── NPM Registry Check ─────────────────────────────────
/**
 * Check the npm registry for a newer version of codesquad.
 * Uses a simple HTTP request to the npm registry API.
 */
export async function checkLatestVersion() {
    const current = getVersionInfo().cliVersion;
    try {
        const url = 'https://registry.npmjs.org/codesquad/latest';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' },
        });
        clearTimeout(timeout);
        if (!response.ok) {
            return { current, latest: null, updateAvailable: false, error: `HTTP ${response.status}` };
        }
        const data = (await response.json());
        const latest = data.version ?? null;
        if (latest && latest !== current) {
            // Simple semver comparison: check if latest > current
            const updateAvailable = compareVersions(latest, current) > 0;
            return { current, latest, updateAvailable };
        }
        return { current, latest, updateAvailable: false };
    }
    catch (err) {
        return {
            current,
            latest: null,
            updateAvailable: false,
            error: err.message,
        };
    }
}
/**
 * Simple semver comparison. Returns -1, 0, or 1.
 */
function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const va = pa[i] ?? 0;
        const vb = pb[i] ?? 0;
        if (va > vb)
            return 1;
        if (va < vb)
            return -1;
    }
    return 0;
}
//# sourceMappingURL=version-core.js.map