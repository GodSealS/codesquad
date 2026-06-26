/**
 * TaskListTool — list active/all tasks.
 *
 * Feature 2 — P4 Task System
 */
import { z } from 'zod';
import { type Tool } from './types.js';
declare const InputSchema: z.ZodObject<{
    filter: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        active: "active";
        all: "all";
    }>>>;
}, z.core.$strip>;
type Input = z.infer<typeof InputSchema>;
export declare const TaskListTool: Tool<Input, any>;
export {};
//# sourceMappingURL=TaskListTool.d.ts.map