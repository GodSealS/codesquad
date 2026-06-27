/**
 * EnterPlanModeTool — agent switches to plan mode to strategize before implementing.
 *
 * Agent calls this when it needs to think through architecture, design options,
 * or implementation plan before writing code. In plan mode, only read-only tools
 * are available.
 *
 * References:
 *   Claude Code src/tools/EnterPlanModeTool/
 *
 * Feature 5 — P5 Vibe Coding
 */
import { z } from 'zod';
import { type Tool } from './types.js';
declare const InputSchema: z.ZodObject<{
    reason: z.ZodString;
}, z.core.$strip>;
type Input = z.infer<typeof InputSchema>;
export declare const EnterPlanModeTool: Tool<Input, any>;
export {};
//# sourceMappingURL=EnterPlanModeTool.d.ts.map