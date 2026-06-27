/**
 * check-core — Local definition integrity checker
 *
 * Phase 7.2: Validates that agents/ and skills/ directories are complete
 * and consistent with their manifest files.
 */
export interface CheckIssue {
    type: 'error' | 'warning';
    file: string;
    message: string;
}
export interface CheckResult {
    ok: boolean;
    agentCount: number;
    skillCount: number;
    issues: CheckIssue[];
}
/**
 * Run integrity checks on agents/ and skills/ directories.
 */
export declare function runCheck(options?: {
    agents?: boolean;
    skills?: boolean;
}): CheckResult;
//# sourceMappingURL=check-core.d.ts.map