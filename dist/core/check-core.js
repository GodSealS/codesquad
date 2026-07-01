/**
 * check-core — Local definition integrity checker
 *
 * Phase 7.2: Validates that agents/ and skills/ directories are complete
 * and consistent with their manifest files.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { getSkillEntries, getAgentEntries } from './validate-catalog.js';
import { AICORE_AGENTS_DIR, AICORE_SKILLS_DIR, CCGS_CATALOG_PATH } from './paths.js';
// ── Paths ──────────────────────────────────────────────
function agentsDir() {
    return AICORE_AGENTS_DIR;
}
function skillsDir() {
    return AICORE_SKILLS_DIR;
}
function catalogPath() {
    return CCGS_CATALOG_PATH;
}
// ── Frontmatter check ──────────────────────────────────
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
function parseFrontmatter(content) {
    const match = content.match(FRONTMATTER_RE);
    if (!match)
        return null;
    try {
        return parseYaml(match[1] ?? '');
    }
    catch {
        return null;
    }
}
// ── Agent checks ───────────────────────────────────────
function checkAgent(filePath, fileName) {
    const issues = [];
    try {
        const content = readFileSync(filePath, 'utf-8');
        const fm = parseFrontmatter(content);
        if (!fm) {
            issues.push({ type: 'error', file: fileName, message: 'No valid YAML frontmatter found' });
            return issues;
        }
        if (!fm.name) {
            issues.push({ type: 'error', file: fileName, message: 'Missing required field: name' });
        }
        if (!fm.description) {
            issues.push({ type: 'error', file: fileName, message: 'Missing required field: description' });
        }
    }
    catch (err) {
        issues.push({ type: 'error', file: fileName, message: `Cannot read file: ${err.message}` });
    }
    return issues;
}
// ── Skill checks ───────────────────────────────────────
function checkSkill(dirPath, skillName) {
    const issues = [];
    const skillMdPath = join(dirPath, 'SKILL.md');
    if (!existsSync(skillMdPath)) {
        issues.push({ type: 'error', file: `${skillName}/`, message: 'Missing SKILL.md' });
        return issues;
    }
    try {
        const content = readFileSync(skillMdPath, 'utf-8');
        const fm = parseFrontmatter(content);
        if (!fm) {
            issues.push({ type: 'error', file: `${skillName}/SKILL.md`, message: 'No valid YAML frontmatter found' });
            return issues;
        }
        if (!fm.name) {
            issues.push({ type: 'error', file: `${skillName}/SKILL.md`, message: 'Missing required field: name' });
        }
        if (!fm.description) {
            issues.push({ type: 'error', file: `${skillName}/SKILL.md`, message: 'Missing required field: description' });
        }
    }
    catch (err) {
        issues.push({ type: 'error', file: `${skillName}/SKILL.md`, message: `Cannot read file: ${err.message}` });
    }
    return issues;
}
// ── Manifest consistency ────────────────────────────────
function readManifest(type) {
    const baseDir = type === 'agents' ? AICORE_AGENTS_DIR : AICORE_SKILLS_DIR;
    const manifestPath = join(baseDir, 'manifest.yaml');
    if (!existsSync(manifestPath))
        return null;
    try {
        const content = readFileSync(manifestPath, 'utf-8');
        return parseYaml(content);
    }
    catch {
        return null;
    }
}
function checkManifestConsistency(type, issues) {
    const manifest = readManifest(type);
    if (!manifest)
        return; // no manifest, skip
    const dirPath = type === 'agents' ? AICORE_AGENTS_DIR : AICORE_SKILLS_DIR;
    if (!existsSync(dirPath))
        return;
    // Check: manifest count matches disk count
    if (type === 'agents') {
        const diskFiles = readdirSync(dirPath).filter((f) => f.endsWith('.md'));
        if (manifest.count !== diskFiles.length) {
            issues.push({
                type: 'warning',
                file: `${type}/manifest.yaml`,
                message: `Manifest count (${manifest.count}) != disk count (${diskFiles.length})`,
            });
        }
        // Check: all manifest entries exist on disk
        for (const entry of manifest.entries) {
            const expectedFile = entry.file ?? `${entry.name}.md`;
            if (!existsSync(join(dirPath, expectedFile))) {
                issues.push({
                    type: 'warning',
                    file: `${type}/manifest.yaml`,
                    message: `${entry.name}: listed in manifest but file '${expectedFile}' not found`,
                });
            }
        }
    }
    else {
        const diskDirs = readdirSync(dirPath, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name);
        if (manifest.count !== diskDirs.length) {
            issues.push({
                type: 'warning',
                file: `${type}/manifest.yaml`,
                message: `Manifest count (${manifest.count}) != disk count (${diskDirs.length})`,
            });
        }
        for (const entry of manifest.entries) {
            const dirName = entry.directory ?? entry.name;
            if (!diskDirs.includes(dirName)) {
                issues.push({
                    type: 'warning',
                    file: `${type}/manifest.yaml`,
                    message: `${entry.name}: listed in manifest but directory '${dirName}' not found`,
                });
            }
        }
    }
}
// ── Full check ─────────────────────────────────────────
/**
 * Run integrity checks on agents/ and skills/ directories.
 */
export function runCheck(options) {
    // If neither specified, check both
    const doAgents = options?.agents ?? (!options?.skills);
    const doSkills = options?.skills ?? (!options?.agents);
    const allIssues = [];
    let agentCount = 0;
    let skillCount = 0;
    // Check agents
    if (doAgents) {
        const ad = agentsDir();
        if (existsSync(ad)) {
            const files = readdirSync(ad).filter((f) => f.endsWith('.md'));
            agentCount = files.length;
            for (const file of files) {
                const filePath = join(ad, file);
                allIssues.push(...checkAgent(filePath, file));
            }
        }
        else {
            allIssues.push({ type: 'error', file: 'agents/', message: 'agents/ directory not found' });
        }
    }
    // Check skills
    if (doSkills) {
        const sd = skillsDir();
        if (existsSync(sd)) {
            const dirs = readdirSync(sd, { withFileTypes: true })
                .filter((d) => d.isDirectory());
            skillCount = dirs.length;
            for (const dir of dirs) {
                const dirPath = join(sd, dir.name);
                allIssues.push(...checkSkill(dirPath, dir.name));
            }
        }
        else {
            allIssues.push({ type: 'error', file: 'skills/', message: 'skills/ directory not found' });
        }
    }
    // Check manifest consistency
    if (doAgents)
        checkManifestConsistency('agents', allIssues);
    if (doSkills)
        checkManifestConsistency('skills', allIssues);
    // Check catalog consistency
    try {
        const catalogSkills = getSkillEntries();
        const catalogAgents = getAgentEntries();
        const catalogSkillNames = new Set(catalogSkills.map((s) => s.name));
        const catalogAgentNames = new Set(catalogAgents.map((a) => a.name));
        // Check: all skills on disk are in catalog
        if (doSkills) {
            const sd = skillsDir();
            if (existsSync(sd)) {
                const diskSkills = readdirSync(sd, { withFileTypes: true })
                    .filter((d) => d.isDirectory())
                    .map((d) => d.name);
                for (const name of diskSkills) {
                    if (!catalogSkillNames.has(name)) {
                        allIssues.push({
                            type: 'warning',
                            file: `skills/${name}/`,
                            message: 'Skill exists on disk but not in catalog.yaml',
                        });
                    }
                }
                for (const name of catalogSkillNames) {
                    if (!diskSkills.includes(name)) {
                        allIssues.push({
                            type: 'warning',
                            file: `skills/${name}/`,
                            message: 'Skill in catalog.yaml but directory not found on disk',
                        });
                    }
                }
            }
        }
        // Check: all agents on disk are in catalog
        if (doAgents) {
            const ad = agentsDir();
            if (existsSync(ad)) {
                const diskAgents = readdirSync(ad)
                    .filter((f) => f.endsWith('.md'))
                    .map((f) => f.replace(/\.md$/, ''));
                for (const name of diskAgents) {
                    if (!catalogAgentNames.has(name)) {
                        allIssues.push({
                            type: 'warning',
                            file: `agents/${name}.md`,
                            message: 'Agent exists on disk but not in catalog.yaml',
                        });
                    }
                }
                for (const name of catalogAgentNames) {
                    if (!diskAgents.includes(name)) {
                        allIssues.push({
                            type: 'warning',
                            file: `agents/${name}.md`,
                            message: 'Agent in catalog.yaml but file not found on disk',
                        });
                    }
                }
            }
        }
    }
    catch (err) {
        allIssues.push({ type: 'warning', file: 'catalog.yaml', message: `Could not check catalog consistency: ${err.message}` });
    }
    const errors = allIssues.filter((i) => i.type === 'error');
    return {
        ok: errors.length === 0,
        agentCount,
        skillCount,
        issues: allIssues,
    };
}
//# sourceMappingURL=check-core.js.map