/**
 * validate-ci — CI mode for validate command
 *
 * Phase 8.2: JSON output + exit codes for CI pipelines.
 */
import { validateStaticAll } from './validate-core.js';
import { getCoverageStats, getSkillEntries } from './validate-catalog.js';
// ── Public API ─────────────────────────────────────────
/**
 * Run validation in CI mode.
 * @param failOnWarn If true, WARN results also count as failures for exit code.
 * @returns CIResult and an exit code (0 = pass, 1 = fail)
 */
export async function runCIValidation(failOnWarn = false) {
    const skillNames = getSkillEntries().map((s) => s.name);
    const { results, summary } = await validateStaticAll(skillNames);
    const coverage = getCoverageStats();
    const passed = results.filter((r) => r.verdict === 'COMPLIANT').length;
    const warnings = results.filter((r) => r.verdict === 'WARNINGS').length;
    const failed = results.filter((r) => r.verdict === 'NON-COMPLIANT').length;
    // Overall verdict
    let overallVerdict = 'COMPLIANT';
    if (failed > 0) {
        overallVerdict = 'NON-COMPLIANT';
    }
    else if (warnings > 0) {
        overallVerdict = failOnWarn ? 'NON-COMPLIANT' : 'WARNINGS';
    }
    const ciResult = {
        passed,
        warnings,
        failed,
        verdict: overallVerdict,
        coverage: {
            skillsTested: coverage.skillsTested,
            skillsTotal: coverage.totalSkills,
            percentage: `${((coverage.skillsTested / Math.max(coverage.totalSkills, 1)) * 100).toFixed(1)}%`,
        },
        results: results.map((r) => ({
            name: r.skillName,
            verdict: r.verdict,
            fails: r.totalFails,
            warns: r.totalWarns,
        })),
    };
    const exitCode = (overallVerdict === 'NON-COMPLIANT') ? 1 : 0;
    return { result: ciResult, exitCode };
}
//# sourceMappingURL=validate-ci.js.map