/**
 * TaskGetTool — query task status and result by ID.
 *
 * Feature 2 — P4 Task System
 */
import { z } from 'zod';
import { type Tool } from './types.js';
import type { Task } from '../tasks/types.js';
declare const InputSchema: z.ZodObject<{
    task_id: z.ZodString;
}, z.core.$strip>;
type Input = z.infer<typeof InputSchema>;
export declare const TaskGetTool: Tool<Input, Task | null>;
export {};
//# sourceMappingURL=TaskGetTool.d.ts.map