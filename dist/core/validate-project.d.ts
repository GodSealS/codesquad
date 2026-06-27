/**
 * validate-project — Project-level validation
 *
 * Phase 8.3: Comprehensive project checks including:
 * - Agent/Skill static checks (from validate-core)
 * - Catalog consistency (disk vs catalog.yaml)
 * - Template completeness
 * - Configuration validity
 */
import { type StaticResult } from './validate-core.js';
export interface ProjectCheckItem {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    detail?: string;
}
export interface ProjectValidationResult {
    ok: boolean;
    checks: ProjectCheckItem[];
    agentResults: StaticResult[];
    errors: number;
    warnings: number;
}
/**
 * Run project-level validation.
 */
export declare function validateProject(strict?: boolean): ProjectValidationResult;
//# sourceMappingURL=validate-project.d.ts.map