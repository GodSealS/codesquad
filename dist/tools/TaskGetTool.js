/**
 * TaskGetTool — query task status and result by ID.
 *
 * Feature 2 — P4 Task System
 */
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { buildTool } from './types.js';
import { getTask, listTasks as listAllTasks } from '../tasks/store.js';
const InputSchema = z.object({
    task_id: z.string().describe('Task ID (first 8 chars)'),
});
export const TaskGetTool = buildTool({
    name: 'TaskGet',
    description: 'Get task status and result by ID.',
    searchHint: 'task get status result',
    inputSchema: InputSchema,
    prompt() {
        return `Gets the status and result of a task by its ID.

Parameters:
- task_id: The task ID (accepts first 8 characters for convenience).

Returns task details including status, result summary, and timestamps.`;
    },
    descriptionFor(input) {
        return `Get task ${input.task_id}`;
    },
    isEnabled() { return true; },
    isReadOnly() { return true; },
    isConcurrencySafe() { return true; },
    isDestructive() { return false; },
    validateInput(input, _ctx) {
        if (!input.task_id.trim())
            return { valid: false, message: 'Task ID is required' };
        return { valid: true };
    },
    checkPermissions() { return { behavior: 'allow' }; },
    async call(input, _context) {
        // Find task by exact ID first, then prefix match
        let task = getTask(input.task_id);
        if (!task) {
            for (const t of listAllTasks()) {
                if (t.id.startsWith(input.task_id)) {
                    task = t;
                    break;
                }
            }
        }
        if (!task) {
            return {
                toolCallId: randomUUID(),
                output: null,
                content: `❌ Task not found: "${input.task_id}"`,
                isError: true,
            };
        }
        const resultInfo = task.result
            ? `\nResult: ${task.result.summary.slice(0, 200)}\nTurns: ${task.result.turns}, Tool calls: ${task.result.toolCalls}`
            : '';
        return {
            toolCallId: randomUUID(),
            output: task,
            content: `📋 Task: ${task.name}\n` +
                `   ID: ${task.id.slice(0, 8)}\n` +
                `   Agent: @${task.agentType}\n` +
                `   Status: ${task.status}\n` +
                `   Background: ${task.runInBackground ? 'yes' : 'no'}\n` +
                `   Created: ${task.createdAt.slice(0, 19)}${resultInfo}`,
        };
    },
    maxResultSizeChars: 2000,
});
//# sourceMappingURL=TaskGetTool.js.map