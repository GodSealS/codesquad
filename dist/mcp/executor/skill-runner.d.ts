/**
 * Skill Runner — Single-call LLM execution engine
 *
 * Skills execute in a single LLM call (no tool-call loop by default).
 * For skills that need multi-turn execution, maxTurns can be specified.
 *
 * Per D-05: Skill invocation uses independent LLM call (option a).
 * Per D-13: Default maxTurns = 5 for skills.
 */
import type { ModelConfig } from '../llm/types.js';
export interface SkillInvokeArgs {
    name: string;
    arguments?: Record<string, unknown>;
    context?: {
        gdd?: string;
        code?: string;
        workspace_root?: string;
    };
    model_config: ModelConfig;
}
export interface SkillInvokeResult {
    success: boolean;
    output: string;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        cost_estimate: number;
    };
    error?: string;
}
export declare function runSkill(projectRoot: string, args: SkillInvokeArgs): Promise<SkillInvokeResult>;
//# sourceMappingURL=skill-runner.d.ts.map