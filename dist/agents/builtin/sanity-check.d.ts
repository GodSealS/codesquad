/**
 * Sanity Check Agent — quick read-only code quality check.
 *
 * Used by AgentTool when subagent_type="sanity-check".
 * Performs fast file-level review: catches obvious bugs, anti-patterns,
 * style violations. Does NOT replace /code-review — that is a multi-phase
 * user-invokable skill workflow.
 *
 * Phase 6.5
 */
import type { AgentDefinition } from '../definition.js';
export declare const sanityCheckAgent: AgentDefinition;
//# sourceMappingURL=sanity-check.d.ts.map