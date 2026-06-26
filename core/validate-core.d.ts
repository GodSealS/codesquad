/**
 * validate-core — 7-check static validation engine
 *
 * Phase 6.1: Implements deterministic static checks for skill markdown files.
 * Behaviorally consistent with the AI-driven `/skill-test static` command.
 *
 * Works on raw skill content + filename. Does NOT use SkillDef (need raw frontmatter access).
 */
export interface CheckResult {
    name: string;
    result: 'PASS' | 'FAIL' | 'WARN';
    detail?: string;
}
export interface StaticResult {
    skillName: string;
    checks: {
        check1: CheckResult;
        check2: CheckResult;
        check3: CheckResult;
        check4: CheckResult;
        check5: CheckResult;
        check6: CheckResult;
        check7: CheckResult;
    };
    verdict: 'COMPLIANT' | 'WARNINGS' | 'NON-COMPLIANT';
    totalFails: number;
    totalWarns: number;
}
export interface ValidateAllResult {
    results: StaticResult[];
    summary: string;
}
/**
 * Run all 7 static checks on a single skill by name.
 * Reads skill from `skills/<name>/SKILL.md`.
 * Engine-category skills (per catalog.yaml) are treated as domain-reference
 * skills and exempted from the public-skill frontmatter/verdict/handoff
 * requirements.
 */
export declare function validateStaticOne(name: string): Promise<StaticResult>;
/**
 * Run all 7 static checks directly on raw content (for testing/CI).
 * `engineCategory` defaults to false; pass true to mark this content as a
 * domain-reference skill.
 */
export declare function validateStaticContent(content: string, sourcePath?: string, engineCategory?: boolean): StaticResult;
/**
 * Run all 7 static checks on all skills in `skills/` directory.
 * Uses a predefined manifest list (Phase 7 will introduce manifest.yaml).
 */
export declare function validateStaticAll(skillNames: string[]): Promise<ValidateAllResult>;
//# sourceMappingURL=validate-core.d.ts.map