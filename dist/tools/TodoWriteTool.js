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
            '## TodoWrite — 结构化任务追踪',
            '',
            '使用此工具创建和管理当前会话中的结构化任务列表，帮助你追踪进度、组织复杂工作、并向用户展示完成情况。',
            '',
            '### 何时使用',
            '',
            '**主动使用（以下场景必须调用）：**',
            '1. 复杂多步骤任务 — 需要 3 个或更多独立步骤',
            '2. 用户明确要求 todo list',
            '3. 用户提供多个任务（编号列表或逗号分隔）',
            '4. **收到新指令后** — 立即将需求捕获为 todo 项',
            '5. **开始执行某个任务前** — 标记为 in_progress',
            '6. **完成任务后** — 立即标记为 completed，发现新任务时追加',
            '',
            '**跳过使用：**',
            '1. 只有单个简单任务',
            '2. 任务可以在 1-2 步内完成',
            '3. 纯信息性/对话性请求',
            '',
            '### 任务状态管理',
            '',
            '- `pending`: 尚未开始',
            '- `in_progress`: 正在执行（**同时最多 1 个**）',
            '- `completed`: 已完成',
            '- `cancelled`: 不再需要',
            '',
            '**关键规则：**',
            '- 开始工作前标记 in_progress，做完立即标记 completed（不要攒着批量标记）',
            '- 遇到阻塞时保持 in_progress，创建新任务描述阻碍',
            '- 以下情况**不要**标记 completed：测试失败、实现不完整、遇到未解决的错误',
            '',
            '### 示例',
            '',
            '<example>',
            '用户: 实现用户注册、商品目录、购物车和结账流程',
            'AI: *创建 todo list 将每个功能拆成具体步骤*',
            '先从用户注册开始...',
            '</example>',
            '',
            '<example>',
            '用户: 帮我优化 React 应用性能',
            'AI: *先分析代码库，发现多个性能问题*',
            '*创建 todo list: 1) 实现 memoization 2) 添加虚拟滚动 3) 优化图片加载 4) 修复状态循环 5) 代码分割*',
            '先从 memoization 开始...',
            '</example>',
            '',
            '**有疑问时，使用此工具。** 主动追踪任务展示了你对需求完整性的关注。',
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