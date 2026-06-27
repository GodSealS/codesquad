/**
 * AgentTool — spawn a subagent for delegated tasks.
 *
 * References:
 *   Claude Code src/tools/AgentTool/AgentTool.ts (229KB)
 *
 * Phase 6.2 / 6.5
 */
import { z } from 'zod';
import { type Tool } from './types.js';
export declare const AgentInputSchema: z.ZodObject<{
    subagent_type: z.ZodString;
    description: z.ZodString;
    prompt: z.ZodString;
    run_in_background: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    coordinator: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    instance_name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AgentInput = z.infer<typeof AgentInputSchema>;
export declare const AgentTool: Tool<AgentInput, {
    summary: string;
}>;
//# sourceMappingURL=AgentTool.d.ts.map