/**
 * TaskListTool — list active/all tasks.
 *
 * Feature 2 — P4 Task System
 */
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { buildTool } from './types.js';
import { listTasks } from '../tasks/store.js';
const InputSchema = z.object({
    filter: z.enum(['active', 'all']).optional().default('active'),
});
export const TaskListTool = buildTool({
    name: 'TaskList',
    description: 'List active or all tasks.',
    searchHint: 'task list all',
    inputSchema: InputSchema,
    prompt() {
        return `Lists tasks. By default shows only active (pending/running) tasks.

Parameters:
- filter: "active" (default) or "all" — which tasks to show.`;
    },
    descriptionFor(input) {
        return `List ${input.filter} tasks`;
    },
    isEnabled() { return true; },
    isReadOnly() { return true; },
    isConcurrencySafe() { return true; },
    isDestructive() { return false; },
    validateInput() { return { valid: true }; },
    checkPermissions() { return { behavior: 'allow' }; },
    async call(input, _context) {
        const all = listTasks();
        const filtered = input.filter === 'all'
            ? all
            : all.filter((t) => t.status === 'pending' || t.status === 'running');
        if (filtered.length === 0) {
            return {
                toolCallId: randomUUID(),
                output: [],
                content: input.filter === 'all'
                    ? 'No tasks created yet.'
                    : 'No active tasks.',
            };
        }
        const lines = [`📋 ${input.filter === 'all' ? 'All' : 'Active'} Tasks (${filtered.length}):`, ''];
        for (const t of filtered) {
            const statusEmoji = t.status === 'running' ? '🔄' : t.status === 'completed' ? '✅' : t.status === 'failed' ? '❌' : '⏳';
            lines.push(`${statusEmoji} [${t.id.slice(0, 8)}] ${t.name}`);
            lines.push(`   Agent: @${t.agentType} | Status: ${t.status}`);
            if (t.result) {
                lines.push(`   Result: ${t.result.summary.slice(0, 80)}`);
            }
            lines.push('');
        }
        return {
            toolCallId: randomUUID(),
            output: filtered,
            content: lines.join('\n'),
        };
    },
    maxResultSizeChars: 3000,
});
//# sourceMappingURL=TaskListTool.js.map