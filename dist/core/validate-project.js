/**
 * validate-project — Project-level validation
 *
 * Phase 8.3: Comprehensive project checks including:
 * - Agent/Skill static checks (from validate-core)
 * - Catalog consistency (disk vs catalog.yaml)
 * - Template completeness
 * - Configuration validity
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { parse as parseYaml } from 'yaml';
import { validateStaticContent } from './validate-core.js';
import { getSkillEntries, getAgentEntries } from './validate-catalog.js';
import { AICORE_AGENTS_DIR, AICORE_SKILLS_DIR, CLI_TEMPLATES_DIR } from './paths.js';
// ── Paths ──────────────────────────────────────────────
// ── Helpers ────────────────────────────────────────────
function readSkillContent(name) {
    const filePath = join(AICORE_SKILLS_DIR, name, 'SKILL.md');
    if (!existsSync(filePath))
        return null;
    try {
        return readFileSync(filePath, 'utf-8');
    }
    catch {
        return null;
    }
}
function readAllSkillContents() {
    const map = new Map();
    const skillsDir = AICORE_SKILLS_DIR;
    if (!existsSync(skillsDir))
        return map;
    const dirs = readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory());
    for (const dir of dirs) {
        const content = readSkillContent(dir.name);
        if (content) {
            map.set(dir.name, content);
        }
    }
    return map;
}
// ── Main validation ────────────────────────────────────
/**
 * Run project-level validation.
 */
export function validateProject(strict = false) {
    const checks = [];
    let errors = 0;
    let warnings = 0;
    // 1. Catalog consistency
    checks.push(checkCatalogConsistency());
    // 2. Template completeness
    checks.push(checkTemplates());
    // 3. Config validity
    checks.push(checkConfig());
    // 4. Run static checks on all skills
    const skillContents = readAllSkillContents();
    const skillResults = [];
    for (const [name, content] of skillContents) {
        // Look up whether this skill is in the engine category via the catalog
        // and pass that hint so domain-reference skills get the right exemptions.
        let engineCategory = false;
        try {
            const entry = getSkillEntries().find((s) => s.name === name);
            engineCategory = entry?.category === 'engine';
        }
        catch { /* best effort */ }
        const result = validateStaticContent(content, `skills/${name}/SKILL.md`, engineCategory);
        skillResults.push(result);
        if (result.verdict === 'NON-COMPLIANT')
            errors++;
        else if (result.verdict === 'WARNINGS')
            warnings++;
    }
    // Tally check results
    for (const check of checks) {
        if (check.status === 'fail')
            errors++;
        else if (check.status === 'warn')
            warnings++;
    }
    if (strict) {
        // In strict mode, warnings become errors
        checks.forEach((c) => {
            if (c.status === 'warn')
                c.status = 'fail';
        });
        errors += warnings;
        warnings = 0;
    }
    return {
        ok: errors === 0,
        checks,
        agentResults: skillResults,
        errors,
        warnings,
    };
}
// ── Individual checks ──────────────────────────────────
function checkCatalogConsistency() {
    try {
        const catalogSkills = getSkillEntries();
        const catalogAgents = getAgentEntries();
        const skillNames = new Set(catalogSkills.map((s) => s.name));
        const agentNames = new Set(catalogAgents.map((a) => a.name));
        const skillsDir = AICORE_SKILLS_DIR;
        const agentsDir = AICORE_AGENTS_DIR;
        const diskSkills = existsSync(skillsDir)
            ? new Set(readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name))
            : new Set();
        const diskAgents = existsSync(agentsDir)
            ? new Set(readdirSync(agentsDir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')))
            : new Set();
        const skillsOnlyInCatalog = [...skillNames].filter((s) => !diskSkills.has(s));
        const agentsOnlyInCatalog = [...agentNames].filter((a) => !diskAgents.has(a));
        const skillsOnlyOnDisk = [...diskSkills].filter((s) => !skillNames.has(s));
        const agentsOnlyOnDisk = [...diskAgents].filter((a) => !agentNames.has(a));
        const inconsistencies = [
            ...skillsOnlyInCatalog.map((s) => `Skill in catalog not on disk: ${s}`),
            ...agentsOnlyInCatalog.map((a) => `Agent in catalog not on disk: ${a}`),
            ...skillsOnlyOnDisk.map((s) => `Skill on disk not in catalog: ${s}`),
            ...agentsOnlyOnDisk.map((a) => `Agent on disk not in catalog: ${a}`),
        ];
        if (inconsistencies.length > 0) {
            return {
                name: 'Catalog Consistency',
                status: 'warn',
                detail: `${inconsistencies.length} inconsistencies found:\n    ${inconsistencies.join('\n    ')}`,
            };
        }
        return { name: 'Catalog Consistency', status: 'pass', detail: `Skills: ${skillNames.size}, Agents: ${agentNames.size} — all consistent` };
    }
    catch (err) {
        return { name: 'Catalog Consistency', status: 'fail', detail: `Error: ${err.message}` };
    }
}
function checkTemplates() {
    const templatesDir = CLI_TEMPLATES_DIR;
    if (!existsSync(templatesDir)) {
        return { name: 'Templates', status: 'warn', detail: 'templates/ directory not found' };
    }
    const requiredTemplates = ['docs/COLLABORATIVE-DESIGN-PRINCIPLE.md', 'docs/WORKFLOW-GUIDE.md'];
    const missing = [];
    for (const tmpl of requiredTemplates) {
        const tmplPath = join(templatesDir, tmpl);
        if (!existsSync(tmplPath)) {
            missing.push(tmpl);
        }
    }
    if (missing.length > 0) {
        return { name: 'Templates', status: 'warn', detail: `Missing: ${missing.join(', ')}` };
    }
    return { name: 'Templates', status: 'pass', detail: 'Required templates present' };
}
function checkConfig() {
    const configPath = resolve(process.cwd(), 'codesquad.config.yaml');
    if (!existsSync(configPath)) {
        return { name: 'Configuration', status: 'warn', detail: 'codesquad.config.yaml not found' };
    }
    try {
        const content = readFileSync(configPath, 'utf-8');
        const config = parseYaml(content);
        if (!config.version || !config.tools) {
            return { name: 'Configuration', status: 'warn', detail: 'Missing required fields: version and/or tools' };
        }
        const tools = Array.isArray(config.tools) ? config.tools : [];
        return { name: 'Configuration', status: 'pass', detail: `Version ${config.version}, ${tools.length} tool(s) bound` };
    }
    catch (err) {
        return { name: 'Configuration', status: 'fail', detail: `Parse error: ${err.message}` };
    }
}
//# sourceMappingURL=validate-project.js.map