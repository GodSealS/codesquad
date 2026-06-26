/**
 * TaskStopTool — stop a running task.
 *
 * Feature 2 — P4 Task System
 */
import { z } from 'zod';
import { type Tool } from './types.js';
declare const InputSchema: z.ZodObject<{
    task_id: z.ZodString;
}, z.core.$strip>;
type Input = z.infer<typeof InputSchema>;
export declare const TaskStopTool: Tool<Input, any>;
export {};
//# sourceMappingURL=TaskStopTool.d.ts.map