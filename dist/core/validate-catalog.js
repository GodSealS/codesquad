/**
 * validate-catalog — Catalog YAML data layer
 *
 * Phase 6.2: Reads and queries `CCGS Skill Testing Framework/catalog.yaml`.
 * Provides unified data access for both CLI validate and AI /skill-test.
 */
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { CCGS_CATALOG_PATH } from './paths.js';
// ── Paths ──────────────────────────────────────────────
function getCatalogPath() {
    return CCGS_CATALOG_PATH;
}
// ── Read ───────────────────────────────────────────────
let _catalogCache = null;
let _catalogCachePath = null;
/**
 * Read and parse the catalog.yaml file.
 * Results are cached in-process for repeated access.
 */
export function readCatalog() {
    const catalogPath = getCatalogPath();
    if (_catalogCache && _catalogCachePath === catalogPath) {
        return _catalogCache;
    }
    if (!existsSync(catalogPath)) {
        throw new Error(`Catalog file not found: ${catalogPath}`);
    }
    const content = readFileSync(catalogPath, 'utf-8');
    const raw = parseYaml(content);
    // Normalize: ensure arrays exist
    const skills = (Array.isArray(raw.skills) ? raw.skills : []);
    const agents = (Array.isArray(raw.agents) ? raw.agents : []);
    _catalogCache = {
        version: raw.version ?? 1,
        last_updated: raw.last_updated ?? '',
        skills,
        agents,
    };
    _catalogCachePath = catalogPath;
    return _catalogCache;
}
/**
 * Clear the in-process cache (useful for tests).
 */
export function clearCatalogCache() {
    _catalogCache = null;
    _catalogCachePath = null;
}
// ── Query: Skills ──────────────────────────────────────
export function getSkillEntries() {
    return readCatalog().skills;
}
export function getSkillByName(name) {
    return readCatalog().skills.find((s) => s.name === name);
}
export function getSkillsByCategory(category) {
    return readCatalog().skills.filter((s) => s.category === category);
}
export function getSkillsByPriority(priority) {
    return readCatalog().skills.filter((s) => s.priority === priority);
}
// ── Query: Agents ──────────────────────────────────────
export function getAgentEntries() {
    return readCatalog().agents;
}
export function getAgentByName(name) {
    return readCatalog().agents.find((a) => a.name === name);
}
export function getAgentsByCategory(category) {
    return readCatalog().agents.filter((a) => a.category === category);
}
export function getCoverageStats() {
    const catalog = readCatalog();
    const skills = catalog.skills;
    const agents = catalog.agents;
    const skillsTested = skills.filter((s) => s.last_static_result !== '').length;
    const agentsTested = agents.filter((a) => a.last_spec_result !== '').length;
    // Count by verdict
    const skillsCompliant = skills.filter((s) => s.last_static_result === 'COMPLIANT').length;
    const skillsWithWarnings = skills.filter((s) => s.last_static_result === 'WARNINGS').length;
    const skillsNonCompliant = skills.filter((s) => s.last_static_result !== '' && s.last_static_result !== 'COMPLIANT' && s.last_static_result !== 'WARNINGS').length;
    // By category
    const byCategory = {};
    for (const s of skills) {
        const cat = s.category ?? 'unknown';
        if (!byCategory[cat])
            byCategory[cat] = { total: 0, tested: 0 };
        byCategory[cat].total++;
        if (s.last_static_result !== '')
            byCategory[cat].tested++;
    }
    // By priority
    const byPriority = {};
    for (const s of skills) {
        const pri = s.priority ?? 'unknown';
        if (!byPriority[pri])
            byPriority[pri] = { total: 0, tested: 0 };
        byPriority[pri].total++;
        if (s.last_static_result !== '')
            byPriority[pri].tested++;
    }
    return {
        totalSkills: skills.length,
        totalAgents: agents.length,
        skillsTested,
        agentsTested,
        skillsCompliant,
        skillsWithWarnings,
        skillsNonCompliant,
        byCategory,
        byPriority,
    };
}
// ── Update ─────────────────────────────────────────────
/**
 * Update the last_static fields for a skill in the catalog.
 * Writes back to the catalog.yaml file.
 */
export function updateStaticResult(name, date, result, writeBack = false) {
    const catalog = readCatalog();
    const entry = catalog.skills.find((s) => s.name === name);
    if (!entry) {
        throw new Error(`Skill '${name}' not found in catalog`);
    }
    entry.last_static = date;
    entry.last_static_result = result;
    if (writeBack) {
        writeCatalog(catalog);
    }
}
/**
 * Write the catalog back to disk.
 * Only used when explicitly requested (e.g., CI update).
 */
export function writeCatalog(catalog) {
    const catalogPath = getCatalogPath();
    // Build the YAML structure matching original format
    const output = {
        version: catalog.version,
        last_updated: catalog.last_updated || new Date().toISOString().split('T')[0],
        skills: catalog.skills.map((s) => ({
            name: s.name,
            spec: s.spec,
            last_static: s.last_static,
            last_static_result: s.last_static_result,
            last_spec: s.last_spec,
            last_spec_result: s.last_spec_result,
            last_category: s.last_category,
            last_category_result: s.last_category_result,
            priority: s.priority,
            category: s.category,
        })),
        agents: catalog.agents.map((a) => ({
            name: a.name,
            spec: a.spec,
            last_static: a.last_static ?? '',
            last_static_result: a.last_static_result ?? '',
            last_spec: a.last_spec,
            last_spec_result: a.last_spec_result,
            last_category: a.last_category ?? '',
            last_category_result: a.last_category_result ?? '',
            category: a.category,
        })),
    };
    const yamlStr = stringifyYaml(output, { lineWidth: 120 });
    writeFileSync(catalogPath, yamlStr, 'utf-8');
    // Update cache
    _catalogCache = catalog;
    _catalogCachePath = catalogPath;
}
//# sourceMappingURL=validate-catalog.js.map