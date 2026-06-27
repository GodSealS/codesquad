/**
 * validate-rubric — Quality rubric data layer
 *
 * Phase 6.2: Parses `CCGS Skill Testing Framework/quality-rubric.md`
 * to extract category definitions, metric counts, and pass criteria.
 * Used by both CLI validate and AI /skill-test category.
 */
import { readFileSync, existsSync } from 'fs';
import { CCGS_RUBRIC_PATH } from './paths.js';
// ── Path ──────────────────────────────────────────────
function getRubricPath() {
    return CCGS_RUBRIC_PATH;
}
// ── Parsing ───────────────────────────────────────────
/**
 * Parse the quality-rubric.md into structured rubric data.
 */
export function parseRubric() {
    const rubricPath = getRubricPath();
    const categories = [];
    if (!existsSync(rubricPath)) {
        return { categories: [], categoryMap: new Map() };
    }
    const content = readFileSync(rubricPath, 'utf-8');
    // Split into category sections by "### `category_name`"
    const categorySections = content.split(/^### `([^`]+)`\s*$/m);
    // First element is preamble (before first category)
    for (let i = 1; i < categorySections.length; i += 2) {
        const name = categorySections[i]?.trim();
        const body = categorySections[i + 1]?.trim();
        if (!name || !body)
            continue;
        const category = parseCategorySection(name, body);
        if (category) {
            categories.push(category);
        }
    }
    const categoryMap = new Map();
    for (const cat of categories) {
        categoryMap.set(cat.name, cat);
    }
    return { categories, categoryMap };
}
function parseCategorySection(name, body) {
    // Extract skills list: **Skills**: skill1, skill2, ...
    const skillsMatch = body.match(/\*\*Skills?\*\*:\s*(.+)/);
    const skills = skillsMatch
        ? skillsMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    // Extract description: text before the metrics table
    const descParts = body.split(/\n\s*\|/);
    const description = descParts[0]?.replace(/^[\s\S]*?\*\*Skills?\*\*:.*?\n/, '').trim() ?? '';
    // Extract exception notes
    const exceptionsMatch = body.match(/>\s*\*\*Exceptions?:\*\*\s*\n([\s\S]*?)(?=\n---|\n###|\n$)/);
    const exceptions = exceptionsMatch ? exceptionsMatch[1].trim() : undefined;
    // Parse metrics table: | **ID — Name** | criteria |
    const metrics = [];
    const tableLines = body.split('\n');
    let inTable = false;
    for (const line of tableLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('| **') && trimmed.includes('** |')) {
            inTable = true;
            const cells = trimmed.split('|').map((c) => c.trim()).filter(Boolean);
            if (cells.length >= 2) {
                const metricParts = cells[0].replace(/\*\*/g, '').split(' — ');
                const id = metricParts[0]?.trim() ?? '';
                const metricName = metricParts.slice(1).join(' — ').trim() || id;
                if (id) {
                    metrics.push({
                        id,
                        name: metricName,
                        passCriteria: cells[1]?.trim() ?? '',
                    });
                }
            }
        }
        else if (inTable && !trimmed.startsWith('|')) {
            inTable = false;
        }
    }
    return {
        name,
        skills,
        description,
        metrics,
        exceptions,
    };
}
// ── Query ─────────────────────────────────────────────
/**
 * Get rubric category for a skill by name.
 * Uses the skill-to-category mapping from the rubric's **Skills** lines.
 */
export function getCategoryForSkill(skillName) {
    const { categories } = parseRubric();
    for (const cat of categories) {
        if (cat.skills.includes(skillName)) {
            return cat;
        }
    }
    return undefined;
}
/**
 * Get the metric count for a skill's category.
 */
export function getMetricCountForSkill(skillName) {
    const cat = getCategoryForSkill(skillName);
    return cat ? cat.metrics.length : 0;
}
/**
 * Get all rubric categories.
 */
export function getRubricCategories() {
    return parseRubric().categories;
}
//# sourceMappingURL=validate-rubric.js.map