/**
 * TodoWriteTool — persistent task tracking within a session.
 *
 * References:
 *   Claude Code src/tools/TodoWriteTool/TodoWriteTool.ts
 *
 * Phase 7.3
 */
import { z } from 'zod';
import { type Tool } from './types.js';
export declare const TodoWriteInputSchema: z.ZodObject<{
    todos: z.ZodArray<z.ZodObject<{
        content: z.ZodString;
        status: z.ZodEnum<{
            cancelled: "cancelled";
            pending: "pending";
            in_progress: "in_progress";
            completed: "completed";
        }>;
        priority: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            high: "high";
            medium: "medium";
            low: "low";
        }>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TodoWriteInput = z.infer<typeof TodoWriteInputSchema>;
export declare function getSessionTodos(sessionId: string): TodoWriteInput['todos'];
export declare function setSessionTodos(sessionId: string, todos: TodoWriteInput['todos']): void;
export declare function clearSessionTodos(sessionId: string): void;
export declare const TodoWriteTool: Tool<TodoWriteInput, {
    todos: TodoWriteInput['todos'];
}>;
//# sourceMappingURL=TodoWriteTool.d.ts.map