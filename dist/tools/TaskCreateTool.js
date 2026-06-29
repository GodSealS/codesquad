/**
 * TaskCreateTool — create and optionally spawn background tasks.
 *
 * Feature 2 — P4 Task System
 *
 * References:
 *   Claude Code src/tools/TaskCreateTool/
 */
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { buildTool } from './types.js';
import { createTask, updateTask, getActiveTaskCount } from '../tasks/store.js';
// ── Helpers ──
/**
 * Execute a task synchronously using the agent runner.
 * Creates an isolated session and runs the agent with the task prompt.
 */
async function executeTask(task, parentContext) {
    // Dynamically import to avoid circular deps at module load time
    const { runAgent } = await import('../chat/agent-runner.js');
    const { createSession } = await import('../chat/session.js');
    const { chatModeToPermissionMode } = await import('../permissions/mode.js');
    const taskSession = createSession(task.agentType, parentContext.session.modelConfig || {});
    taskSession.id = `task-${task.id.slice(0, 8)}`;
    try {
        const result = await runAgent({
            agentName: task.agentType,
            userInput: task.prompt,
            session: taskSession,
            providerId: parentContext.session.id, // inherit provider context
            modelId: parentContext.session.modelConfig?.model || 'claude-sonnet-4-20250514',
            projectRoot: parentContext.projectRoot,
            aicoreDir: parentContext.aicoreDir || parentContext.projectRoot + '/AICore',
            mode: 'ask',
            maxTurns: 15,
        });
        return result;
    }
    catch (err) {
        return {
            finalResponse: '',
            turnsUsed: 0,
            toolCallsMade: 0,
            error: err.message,
        };
    }
}
/**
 * Spawn a task in background (fire-and-forget).
 * Mirrors Claude Code registerAsyncAgent: registers state, spawns execution.
 *
 * @param task - The task to execute
 * @param parentContext - The original ToolUseContext from the calling agent
 */
function spawnBackgroundTask(task, parentContext) {
    // Fire-and-forget: don't await
    // Clone the essential fields from parentContext so runAgent() has valid projectRoot/aicoreDir
    const bgContext = {
        ...parentContext,
        session: parentContext.session,
        cwd: parentContext.projectRoot,
        projectRoot: parentContext.projectRoot,
        abortSignal: task.abortController?.signal || new AbortController().signal,
        headless: true,
    };
    executeTask(task, bgContext).then((result) => {
        const status = result.error ? 'failed' : 'completed';
        updateTask(task.id, {
            status,
            completedAt: new Date().toISOString(),
            result: status === 'completed' ? {
                summary: result.finalResponse.slice(0, 500),
                messages: [],
                turns: result.turnsUsed,
                toolCalls: result.toolCallsMade,
            } : undefined,
        });
    }).catch(() => {
        updateTask(task.id, {
            status: 'failed',
            completedAt: new Date().toISOString(),
        });
    });
}
// ── Input Schema ──
const InputSchema = z.object({
    name: z.string().describe('Short task name').optional(),
    description: z.string().describe('Short task name (alias for name)').optional(),
    prompt: z.string().describe('What the agent should do'),
    subagent_type: z.string().describe('Agent type to use'),
    run_in_background: z.boolean().optional().default(false),
});
// ── Tool ──
export const TaskCreateTool = buildTool({
    name: 'TaskCreate',
    description: 'Create a new task. Runs synchronously by default, or in background if specified.',
    searchHint: 'task create delegate background',
    inputSchema: InputSchema,
    prompt() {
        return `Creates a new task for another agent to execute.

Parameters:
- name: Short descriptive name
- prompt: What the subagent should do
- subagent_type: Which agent type to use (e.g., "code-reviewer", "greeting-responder")
- run_in_background: If true, task runs async and returns taskId. If false, runs synchronously.

Returns task status and result. Use TaskGet to check background task status.`;
    },
    descriptionFor(input) {
        const bg = input.run_in_background ? ' (background)' : '';
        return `Create task "${input.name}" using @${input.subagent_type}${bg}`;
    },
    isEnabled(_ctx) {
        return true;
    },
    isReadOnly() {
        return false;
    },
    isConcurrencySafe() {
        return true;
    },
    isDestructive() {
        return false;
    },
    validateInput(input, _ctx) {
        const taskName = input.name?.trim() || input.description?.trim();
        if (!taskName)
            return { valid: false, message: 'Task name is required (use "name" or "description")' };
        if (!input.prompt.trim())
            return { valid: false, message: 'Task prompt is required' };
        if (!input.subagent_type.trim())
            return { valid: false, message: 'Subagent type is required' };
        if (getActiveTaskCount(_ctx.session.id) >= 10) {
            return { valid: false, message: 'Too many active tasks (max 10)' };
        }
        return { valid: true };
    },
    checkPermissions(_input, _ctx) {
        return { behavior: 'allow' };
    },
    async call(input, context) {
        // Fix: accept "description" as fallback for "name" (LLMs often use "description" instead)
        const taskName = input.name?.trim() || input.description?.trim() || input.subagent_type;
        const task = createTask({
            name: taskName,
            prompt: input.prompt,
            agentType: input.subagent_type,
            parentSessionId: context.session.id,
            runInBackground: input.run_in_background,
        });
        // Set up AbortController for task lifecycle
        task.abortController = new AbortController();
        const toolCallId = randomUUID();
        if (input.run_in_background) {
            // Background: spawn async, return immediately
            // Mirrors Claude Code registerAsyncAgent: set isBackgrounded=true, spawn runAgent
            updateTask(task.id, { status: 'running', startedAt: new Date().toISOString() });
            spawnBackgroundTask(task, context);
            return {
                toolCallId,
                output: task,
                content: `✅ Task "${task.name}" created in background.\n` +
                    `   ID: ${task.id.slice(0, 8)}\n` +
                    `   Agent: @${task.agentType}\n` +
                    `   Status: running\n` +
                    `   Use TaskGet to check status.`,
            };
        }
        // Synchronous: execute immediately and block until done
        updateTask(task.id, { status: 'running', startedAt: new Date().toISOString() });
        try {
            const result = await executeTask(task, context);
            updateTask(task.id, {
                status: result.error ? 'failed' : 'completed',
                completedAt: new Date().toISOString(),
                result: {
                    summary: result.finalResponse.slice(0, 500),
                    messages: [],
                    turns: result.turnsUsed,
                    toolCalls: result.toolCallsMade,
                },
            });
            if (result.error) {
                return {
                    toolCallId,
                    output: task,
                    content: `❌ Task "${task.name}" failed: ${result.error}`,
                    isError: true,
                };
            }
            return {
                toolCallId,
                output: task,
                content: `✅ Task "${task.name}" completed.\n` +
                    `   ID: ${task.id.slice(0, 8)}\n` +
                    `   Turns: ${result.turnsUsed}\n` +
                    `   Tool calls: ${result.toolCallsMade}\n` +
                    `   Result: ${result.finalResponse.slice(0, 300)}`,
            };
        }
        catch (err) {
            updateTask(task.id, {
                status: 'failed',
                completedAt: new Date().toISOString(),
            });
            return {
                toolCallId,
                output: task,
                content: `❌ Task "${task.name}" execution error: ${err.message}`,
                isError: true,
            };
        }
    },
    maxResultSizeChars: 2000,
});
//# sourceMappingURL=TaskCreateTool.js.map