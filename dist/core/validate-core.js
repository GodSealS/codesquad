/**
 * validate-core — 7-check static validation engine
 *
 * Phase 6.1: Implements deterministic static checks for skill markdown files.
 * Behaviorally consistent with the AI-driven `/skill-test static` command.
 *
 * Works on raw skill content + filename. Does NOT use SkillDef (need raw frontmatter access).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { AICORE_SKILLS_DIR } from './paths.js';
// ── Frontmatter parsing ────────────────────────────────
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
function parseSkillContent(content, sourcePath) {
    const match = content.match(FRONTMATTER_RE);
    if (!match) {
        return { frontmatter: {}, body: content, sourcePath };
    }
    const [, rawFm, rawBody] = match;
    // Use the yaml library for proper YAML parsing
    const frontmatter = {};
    try {
        const parsed = parseYaml(rawFm ?? '');
        for (const [key, value] of Object.entries(parsed)) {
            if (value === null || value === undefined) {
                frontmatter[key] = '';
            }
            else if (typeof value === 'boolean') {
                frontmatter[key] = String(value);
            }
            else {
                frontmatter[key] = String(value);
            }
        }
    }
    catch {
        // Fallback: empty frontmatter on parse error
    }
    return { frontmatter, body: rawBody ?? '', sourcePath };
}
// ── Path resolution ────────────────────────────────────
function resolveSkillPath(name) {
    return join(AICORE_SKILLS_DIR, name, 'SKILL.md');
}
function readSkill(name) {
    const filePath = resolveSkillPath(name);
    if (!existsSync(filePath)) {
        throw new Error(`Skill not found: ${name} (expected at ${filePath})`);
    }
    const content = readFileSync(filePath, 'utf-8');
    return parseSkillContent(content, filePath);
}
// ── Check 1: Required Frontmatter ──────────────────────
const REQUIRED_FRONTMATTER = ['name', 'description', 'argument-hint', 'user-invocable', 'allowed-tools'];
/**
 * A skill is a "domain reference" (e.g. cocos_2d, ue-blueprint) when it
 * declares `user-invocable: false` OR the catalog marks it as an `engine`
 * category. Such skills are private engine-domain knowledge loaded only by
 * engine specialists; the public-skill fields (argument-hint,
 * user-invocable, allowed-tools) and user-facing verdict/handoff
 * conventions don't apply. We skip the relevant checks.
 */
function isDomainReferenceSkill(skill, engineCategory) {
    if (engineCategory)
        return true;
    return skill.frontmatter['user-invocable'] === 'false';
}
function check1RequiredFrontmatter(skill, engineCategory) {
    if (isDomainReferenceSkill(skill, engineCategory)) {
        return { name: 'Required Frontmatter', result: 'PASS', detail: 'Domain-reference skill (user-invocable: false) — user-facing fields not required' };
    }
    const missing = [];
    for (const field of REQUIRED_FRONTMATTER) {
        if (skill.frontmatter[field] === undefined || skill.frontmatter[field] === '') {
            missing.push(field);
        }
    }
    if (missing.length === 0) {
        return { name: 'Required Frontmatter', result: 'PASS' };
    }
    return {
        name: 'Required Frontmatter',
        result: 'FAIL',
        detail: `Missing: ${missing.join(', ')}`,
    };
}
// ── Check 2: Multiple Phases ───────────────────────────
function check2MultiplePhases(skill, engineCategory) {
    if (isDomainReferenceSkill(skill, engineCategory)) {
        return { name: 'Multiple Phases', result: 'PASS', detail: 'Domain-reference skill — phase workflow not required' };
    }
    // Match "## Phase N" or "## N." style headings
    const phaseMatches = skill.body.match(/^##\s+(?:Phase\s+\d+|\d+\.)/gm);
    const count = phaseMatches ? phaseMatches.length : 0;
    if (count >= 2) {
        return { name: 'Multiple Phases', result: 'PASS', detail: `Found ${count} phase headings` };
    }
    return {
        name: 'Multiple Phases',
        result: 'FAIL',
        detail: `Found ${count} phase heading(s), need ≥ 2`,
    };
}
// ── Check 3: Verdict Keywords ──────────────────────────
const VERDICT_KEYWORDS = /PASS|FAIL|CONCERNS|APPROVED|BLOCKED|COMPLETE|READY|COMPLIANT|NON-COMPLIANT/;
function check3VerdictKeywords(skill, engineCategory) {
    if (isDomainReferenceSkill(skill, engineCategory)) {
        return { name: 'Verdict Keywords', result: 'PASS', detail: 'Domain-reference skill — no skill-mode verdict required' };
    }
    if (VERDICT_KEYWORDS.test(skill.body)) {
        return { name: 'Verdict Keywords', result: 'PASS' };
    }
    return {
        name: 'Verdict Keywords',
        result: 'FAIL',
        detail: 'No verdict keywords found in body',
    };
}
// ── Check 4: Collaborative Protocol ────────────────────
function check4CollaborativeProtocol(skill) {
    const allowedTools = skill.frontmatter['allowed-tools'] ?? '';
    const hasWriteEdit = /\b(?:Write|Edit)\b/i.test(allowedTools);
    if (!hasWriteEdit) {
        // If skill doesn't have Write/Edit tools, this check is not applicable — pass
        // But per plan: WARN or PASS? The plan says PASS/FAIL/WARN for check4.
        // For skills without Write/Edit: PASS (not applicable).
        return { name: 'Collaborative Protocol', result: 'PASS', detail: 'No Write/Edit tools — not applicable' };
    }
    // Must contain collaborative protocol phrase
    const hasProtocol = /"May I write"|before writing|May I write/i.test(skill.body);
    if (hasProtocol) {
        return { name: 'Collaborative Protocol', result: 'PASS' };
    }
    return {
        name: 'Collaborative Protocol',
        result: 'FAIL',
        detail: 'Has Write/Edit tools but missing collaborative protocol ("May I write" / "before writing")',
    };
}
// ── Check 5: Next-Step Handoff ─────────────────────────
const HANDOFF_KEYWORDS = /推荐|Recommended next|Follow-Up|After this|下一个/;
function check5NextStepHandoff(skill, engineCategory) {
    if (isDomainReferenceSkill(skill, engineCategory)) {
        return { name: 'Next-Step Handoff', result: 'PASS', detail: 'Domain-reference skill — no handoff expected' };
    }
    if (HANDOFF_KEYWORDS.test(skill.body)) {
        return { name: 'Next-Step Handoff', result: 'PASS' };
    }
    return {
        name: 'Next-Step Handoff',
        result: 'WARN',
        detail: 'No next-step handoff keywords found',
    };
}
// ── Check 6: Fork Context Complexity ───────────────────
function check6ForkContextComplexity(skill) {
    const context = (skill.frontmatter['context'] ?? '').trim();
    if (context !== 'fork') {
        return { name: 'Fork Context Complexity', result: 'PASS', detail: `context=${context || '(none)'} — not applicable` };
    }
    const phaseMatches = skill.body.match(/^##\s+(?:Phase\s+\d+|\d+\.)/gm);
    const count = phaseMatches ? phaseMatches.length : 0;
    if (count >= 5) {
        return { name: 'Fork Context Complexity', result: 'PASS', detail: `context=fork, ${count} phase headings ≥ 5` };
    }
    return {
        name: 'Fork Context Complexity',
        result: 'WARN',
        detail: `context=fork but only ${count} phase headings (need ≥ 5)`,
    };
}
// ── Check 7: Argument Hint Plausibility ────────────────
function check7ArgumentHintPlausibility(skill, engineCategory) {
    if (isDomainReferenceSkill(skill, engineCategory)) {
        return { name: 'Argument Hint Plausibility', result: 'PASS', detail: 'Domain-reference skill — no argument-hint required' };
    }
    const hint = (skill.frontmatter['argument-hint'] ?? '').trim();
    if (hint === '') {
        return {
            name: 'Argument Hint Plausibility',
            result: 'WARN',
            detail: 'argument-hint is empty',
        };
    }
    // If body contains mode descriptions, hint should reflect that
    const bodyHasMode = /--?(?:depth|mode|review|type)\b/i.test(skill.body);
    const hintReflectsMode = /--?(?:depth|mode|review|type)\b/i.test(hint);
    if (bodyHasMode && !hintReflectsMode) {
        return {
            name: 'Argument Hint Plausibility',
            result: 'WARN',
            detail: 'Body contains mode/option descriptions but argument-hint does not reflect them',
        };
    }
    return { name: 'Argument Hint Plausibility', result: 'PASS' };
}
// ── Compute verdict ────────────────────────────────────
function computeVerdict(checks) {
    let fails = 0;
    let warns = 0;
    const allChecks = [checks.check1, checks.check2, checks.check3, checks.check4, checks.check5, checks.check6, checks.check7];
    for (const c of allChecks) {
        if (c.result === 'FAIL')
            fails++;
        if (c.result === 'WARN')
            warns++;
    }
    if (fails > 0)
        return { verdict: 'NON-COMPLIANT', fails, warns };
    if (warns > 0)
        return { verdict: 'WARNINGS', fails, warns };
    return { verdict: 'COMPLIANT', fails, warns };
}
// ── Public API ─────────────────────────────────────────
/**
 * Run all 7 static checks on a single skill by name.
 * Reads skill from `skills/<name>/SKILL.md`.
 * Engine-category skills (per catalog.yaml) are treated as domain-reference
 * skills and exempted from the public-skill frontmatter/verdict/handoff
 * requirements.
 */
export async function validateStaticOne(name) {
    const skill = readSkill(name);
    const engineCategory = await lookupEngineCategory(name);
    return runChecks(skill, engineCategory);
}
/**
 * Run all 7 static checks directly on raw content (for testing/CI).
 * `engineCategory` defaults to false; pass true to mark this content as a
 * domain-reference skill.
 */
export function validateStaticContent(content, sourcePath = '<inline>', engineCategory = false) {
    const skill = parseSkillContent(content, sourcePath);
    return runChecks(skill, engineCategory);
}
function runChecks(skill, engineCategory) {
    const checks = {
        check1: check1RequiredFrontmatter(skill, engineCategory),
        check2: check2MultiplePhases(skill, engineCategory),
        check3: check3VerdictKeywords(skill, engineCategory),
        check4: check4CollaborativeProtocol(skill),
        check5: check5NextStepHandoff(skill, engineCategory),
        check6: check6ForkContextComplexity(skill),
        check7: check7ArgumentHintPlausibility(skill, engineCategory),
    };
    const { verdict, fails, warns } = computeVerdict(checks);
    return {
        skillName: skill.frontmatter['name'] ?? (skill.sourcePath || '<inline>'),
        checks,
        verdict,
        totalFails: fails,
        totalWarns: warns,
    };
}
/**
 * Look up whether a skill is in the `engine` category via the CCGS catalog.
 * Lazy-imported to avoid a circular dependency with validate-catalog.
 */
async function lookupEngineCategory(name) {
    try {
        const mod = await import('./validate-catalog.js');
        const entry = mod.getSkillByName(name);
        return entry?.category === 'engine';
    }
    catch {
        return false;
    }
}
/**
 * Run all 7 static checks on all skills in `skills/` directory.
 * Uses a predefined manifest list (Phase 7 will introduce manifest.yaml).
 */
export async function validateStaticAll(skillNames) {
    const results = [];
    for (const name of skillNames) {
        try {
            const result = await validateStaticOne(name);
            results.push(result);
        }
        catch (err) {
            results.push({
                skillName: name,
                checks: {
                    check1: { name: 'Required Frontmatter', result: 'FAIL', detail: `Error: ${err.message}` },
                    check2: { name: 'Multiple Phases', result: 'FAIL', detail: 'Skipped due to error' },
                    check3: { name: 'Verdict Keywords', result: 'FAIL', detail: 'Skipped due to error' },
                    check4: { name: 'Collaborative Protocol', result: 'FAIL', detail: 'Skipped due to error' },
                    check5: { name: 'Next-Step Handoff', result: 'FAIL', detail: 'Skipped due to error' },
                    check6: { name: 'Fork Context Complexity', result: 'FAIL', detail: 'Skipped due to error' },
                    check7: { name: 'Argument Hint Plausibility', result: 'FAIL', detail: 'Skipped due to error' },
                },
                verdict: 'NON-COMPLIANT',
                totalFails: 7,
                totalWarns: 0,
            });
        }
    }
    const compliant = results.filter((r) => r.verdict === 'COMPLIANT').length;
    const warnings = results.filter((r) => r.verdict === 'WARNINGS').length;
    const nonCompliant = results.filter((r) => r.verdict === 'NON-COMPLIANT').length;
    const summary = `Validated ${results.length} skills: ${compliant} COMPLIANT, ${warnings} WARNINGS, ${nonCompliant} NON-COMPLIANT`;
    return { results, summary };
}
//# sourceMappingURL=validate-core.js.map