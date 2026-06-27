/**
 * validate-ci — CI mode for validate command
 *
 * Phase 8.2: JSON output + exit codes for CI pipelines.
 */
export interface CIResult {
    passed: number;
    warnings: number;
    failed: number;
    verdict: 'COMPLIANT' | 'WARNINGS' | 'NON-COMPLIANT';
    coverage: {
        skillsTested: number;
        skillsTotal: number;
        percentage: string;
    };
    results: Array<{
        name: string;
        verdict: string;
        fails: number;
        warns: number;
    }>;
}
/**
 * Run validation in CI mode.
 * @param failOnWarn If true, WARN results also count as failures for exit code.
 * @returns CIResult and an exit code (0 = pass, 1 = fail)
 */
export declare function runCIValidation(failOnWarn?: boolean): Promise<{
    result: CIResult;
    exitCode: number;
}>;
//# sourceMappingURL=validate-ci.d.ts.map