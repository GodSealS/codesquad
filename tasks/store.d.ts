/**
 * Task store — in-memory Map + JSON file persistence.
 *
 * Storage: <projectRoot>/.codesquad/tasks/<taskId>.json
 * Mirrors session persistence pattern from src/chat/storage.ts (atomic write).
 *
 * Feature 2 — P4 Task System
 */
import type { Task } from './types.js';
export declare function setTaskStoreRoot(projectRoot: string): void;
export declare function createTask(task: Omit<Task, 'id' | 'status' | 'createdAt'>): Task;
export declare function getTask(id: string): Task | undefined;
export declare function listTasks(sessionId?: string): Task[];
export declare function updateTask(id: string, update: Partial<Task>): Task | undefined;
export declare function deleteTask(id: string): boolean;
export declare function stopTask(id: string): Task | undefined;
export declare function getActiveTaskCount(sessionId?: string): number;
export declare function clearTasks(sessionId?: string): void;
//# sourceMappingURL=store.d.ts.map