/**
 * ExitPlanModeTool — agent presents a complete plan and exits plan mode.
 *
 * After analyzing in plan mode, the agent creates a structured plan and
 * presents it to the user for approval. If approved, the agent returns
 * to its previous mode (ask/craft) and can begin implementation.
 *
 * References:
 *   Claude Code src/tools/ExitPlanModeV2Tool/
 *
 * Feature 5 — P5 Vibe Coding
 */
import { z } from 'zod';
import { type Tool } from './types.js';
declare const InputSchema: z.ZodObject<{
    plan: z.ZodString;
}, z.core.$strip>;
type Input = z.infer<typeof InputSchema>;
export declare const ExitPlanModeTool: Tool<Input, any>;
export {};
//# sourceMappingURL=ExitPlanModeTool.d.ts.map