/**
 * Session data model and CRUD operations.
 *
 * Each REPL conversation is stored as a Session object identified by ULID.
 * Phase 1.2 — Steps 1.2.1, 1.2.3.
 */
import type { TaskResult } from '../core/task-result.js';
export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: string;
    isContext?: boolean;
    toolCalls?: unknown[];
    /** Per-message token usage (Phase P3.4). */
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        cost?: number;
    };
}
/** Todo item persisted to session context (Phase P3.3). */
export interface TodoItem {
    content: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority: 'high' | 'medium' | 'low';
}
export interface SessionContext {
    injectedFiles: string[];
    injectedContent: string;
    /** Session-level todo list (persisted across REPL restart). */
    todos?: TodoItem[];
}
export interface ModelConfig {
    provider: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
}
export interface Session {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    agent: string;
    messages: Message[];
    context: SessionContext;
    modelConfig: ModelConfig;
    status: 'active' | 'idle' | 'archived';
    /** Current chat mode (persisted across sessions).  Defaults to DEFAULT_MODE if absent. */
    mode?: import('../repl/mode.js').ChatMode;
}
export declare function createSession(agent: string, modelConfig: ModelConfig, name?: string): Session;
export declare function save(session: Session): Promise<void>;
export declare function load(id: string): Promise<Session | null>;
export declare function remove(id: string): Promise<void>;
/**
 * Save a session and return a TaskResult instead of void.
 * Use this for new code; original save() remains for backward compat.
 */
export declare function saveWithResult(session: Session): Promise<TaskResult<Session | null>>;
/**
 * Remove a session and return a TaskResult instead of void.
 * Use this for new code; original remove() remains for backward compat.
 */
export declare function removeWithResult(id: string): Promise<TaskResult<null>>;
export interface SessionSummary {
    id: string;
    idShort: string;
    name: string;
    agent: string;
    updatedAt: string;
    messageCount: number;
    status: string;
}
export declare function getSessionPath(id: string): string;
export declare function listSessions(): Promise<SessionSummary[]>;
export declare function findSessionById(partial: string): Promise<Session | null>;
export declare function addMessage(session: Session, role: 'user' | 'assistant' | 'system', content: string, isContext?: boolean): Message;
export declare function getRecentMessages(session: Session, count: number): Message[];
/**
 * Delete a message from the session by index (1-based for user-facing commands).
 * Returns the deleted message or null if index is out of range.
 */
export declare function deleteMessage(session: Session, index1Based: number): Message | null;
//# sourceMappingURL=session.d.ts.map