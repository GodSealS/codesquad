/**
 * TodoWriteTool — persistent task tracking within a session.
 *
 * References:
 *   Claude Code src/tools/TodoWriteTool/TodoWriteTool.ts
 *
 * Phase 7.3
 */
import { z } from 'zod';
import { buildTool } from './types.js';
// ── Schema ──
const TodoItemSchema = z.object({
    content: z.string().min(1).max(500).describe('Task description'),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).describe('Task status'),
    priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
});
export const TodoWriteInputSchema = z.object({
    todos: z.array(TodoItemSchema).min(1).max(50).describe('List of todo items'),
});
// ── Session-level storage ──
const sessionTodos = new Map();
export function getSessionTodos(sessionId) {
    return sessionTodos.get(sessionId) || [];
}
export function setSessionTodos(sessionId, todos) {
    sessionTodos.set(sessionId, todos);
}
export function clearSessionTodos(sessionId) {
    sessionTodos.delete(sessionId);
}
// ── Tool ──
export const TodoWriteTool = buildTool({
    name: 'TodoWrite',
    description: 'Create and manage a structured task list for your current session.',
    searchHint: 'todo task list plan',
    inputSchema: TodoWriteInputSchema,
    maxResultSizeChars: 5000,
    isReadOnly() {
        return false;
    },
    isConcurrencySafe() {
        return true;
    },
    isDestructive() {
        return false;
    },
    prompt() {
        return [
            '## TodoWrite Tool',
            '',
            'Use this to track tasks within your session.',
            'This helps organize complex multi-step work.',
            '',
            '- `todos`: Array of { content, status, priority }',
            '  - status: "pending", "in_progress", "completed", "cancelled"',
            '  - priority: "high", "medium", "low" (default: "medium")',
            '',
            'Update the list as you work through tasks.',
            'Only one task should be "in_progress" at a time.',
        ].join('\n');
    },
    descriptionFor(input) {
        const counts = {
            completed: input.todos.filter((t) => t.status === 'completed').length,
            inProgress: input.todos.filter((t) => t.status === 'in_progress').length,
            pending: input.todos.filter((t) => t.status === 'pending').length,
        };
        return `Update todos: ${counts.completed} done, ${counts.inProgress} in progress, ${counts.pending} pending`;
    },
    validateInput(input, _context) {
        const inProgress = input.todos.filter((t) => t.status === 'in_progress');
        if (inProgress.length > 1) {
            return {
                valid: false,
                message: 'Only one task can be "in_progress" at a time.',
                errorCode: 'MULTIPLE_IN_PROGRESS',
            };
        }
        return { valid: true };
    },
    checkPermissions() {
        return { behavior: 'allow' };
    },
    async call(input, context) {
        // Persist to session context for survival across REPL restart (P3.3)
        setSessionTodos(context.session.id, input.todos);
        if (context.session?.context) {
            context.session.context.todos = input.todos;
        }
        const lines = ['## Todo List', ''];
        for (const todo of input.todos) {
            const icon = {
                pending: '⬜',
                in_progress: '🔄',
                completed: '✅',
                cancelled: '❌',
            }[todo.status];
            const priority = todo.priority === 'high' ? '🔴' : todo.priority === 'low' ? '🔵' : '  ';
            lines.push(`${icon} ${priority} ${todo.content}`);
        }
        return {
            toolCallId: '',
            output: { todos: input.todos },
            content: lines.join('\n'),
        };
    },
});
//# sourceMappingURL=TodoWriteTool.js.map