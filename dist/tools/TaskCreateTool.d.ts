/**
 * TaskCreateTool — create and optionally spawn background tasks.
 *
 * Feature 2 — P4 Task System
 *
 * References:
 *   Claude Code src/tools/TaskCreateTool/
 */
import { z } from 'zod';
import { type Tool } from './types.js';
import type { Task } from '../tasks/types.js';
declare const InputSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    prompt: z.ZodString;
    subagent_type: z.ZodString;
    run_in_background: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
type Input = z.infer<typeof InputSchema>;
export declare const TaskCreateTool: Tool<Input, Task>;
export {};
//# sourceMappingURL=TaskCreateTool.d.ts.map