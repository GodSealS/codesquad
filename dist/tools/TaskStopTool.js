/**
 * TaskStopTool — stop a running task.
 *
 * Feature 2 — P4 Task System
 */
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { buildTool } from './types.js';
import { stopTask } from '../tasks/store.js';
const InputSchema = z.object({
    task_id: z.string().describe('Task ID to stop'),
});
export const TaskStopTool = buildTool({
    name: 'TaskStop',
    description: 'Stop a running task.',
    searchHint: 'task stop cancel abort',
    inputSchema: InputSchema,
    prompt() {
        return `Stops a running task by ID.

Parameters:
- task_id: The task ID to stop.

The task will be marked as "stopped" and its abort controller will be triggered.`;
    },
    descriptionFor(input) {
        return `Stop task ${input.task_id}`;
    },
    isEnabled() { return true; },
    isReadOnly() { return false; },
    isConcurrencySafe() { return true; },
    isDestructive() { return true; },
    validateInput(input, _ctx) {
        if (!input.task_id.trim())
            return { valid: false, message: 'Task ID is required' };
        return { valid: true };
    },
    checkPermissions() { return { behavior: 'allow' }; },
    async call(input, _context) {
        const task = stopTask(input.task_id);
        if (!task) {
            return {
                toolCallId: randomUUID(),
                output: null,
                content: `❌ Task not found: "${input.task_id}"`,
                isError: true,
            };
        }
        return {
            toolCallId: randomUUID(),
            output: task,
            content: `🛑 Task "${task.name}" (${task.id.slice(0, 8)}) stopped.`,
        };
    },
    maxResultSizeChars: 500,
});
//# sourceMappingURL=TaskStopTool.js.map