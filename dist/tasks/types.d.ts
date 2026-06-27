/**
 * Task system types — aligned with Claude Code's Task model.
 *
 * Feature 2 — P4 Task System
 */
import type { Message } from '../chat/session.js';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
export interface Task {
    id: string;
    name: string;
    prompt: string;
    agentType: string;
    parentSessionId: string;
    status: TaskStatus;
    result?: {
        summary: string;
        messages: Message[];
        turns: number;
        toolCalls: number;
    };
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    runInBackground: boolean;
    /** AbortController for stopping running tasks. */
    abortController?: AbortController;
}
//# sourceMappingURL=types.d.ts.map