/**
 * Memory Manager — singleton, scope-aware memory backend.
 *
 * Two independent memory stores:
 *   project — .codesquad/memory/ under project root (conversation + agent memories)
 *   global  — ~/.codesquad/memory/ (user decision preferences, tech choices)
 *
 * Usage:
 *   const mgr = getMemoryManager();
 *   await mgr.store(entry, 'project');
 *   const results = await mgr.retrieve({ query: 'React' }, 'global');
 *
 * References:
 *   Idea/tutrue/memory-system-design.md §2.3.8
 */
import { type MemoryScope } from './workspace-memory.js';
import { type MemoryType } from './memory-types.js';
export type { MemoryScope };
export interface MemoryEntry {
    id?: string;
    name: string;
    description: string;
    type: MemoryType;
    content: string;
    tags?: string[];
    created?: string;
    updated?: string;
    /** Source of this memory: 'user' (human-AI chat) or agent type name. */
    source?: string;
}
export interface MemoryQuery {
    query?: string;
    type?: MemoryType;
    tags?: string[];
    limit?: number;
    source?: string;
}
export interface MemoryResult {
    entry: MemoryEntry;
    score?: number;
    stalenessDays?: number;
}
export interface SessionBrief {
    sessionId: string;
    summary: string;
    keyTopics: string[];
    lastActive: Date;
    messageCount: number;
}
declare class ScopedMemoryStore {
    private scope;
    constructor(scope: MemoryScope);
    get dir(): string;
    store(entry: MemoryEntry): Promise<void>;
    retrieve(query: MemoryQuery): Promise<MemoryResult[]>;
    list(filter?: MemoryQuery): Promise<MemoryEntry[]>;
    delete(_id: string): Promise<void>;
    brief(sessionId: string): Promise<SessionBrief>;
}
export interface MemoryBackend {
    store(entry: MemoryEntry): Promise<void>;
    retrieve(query: MemoryQuery): Promise<MemoryResult[]>;
    list(filter?: MemoryQuery): Promise<MemoryEntry[]>;
    delete(id: string): Promise<void>;
    brief(sessionId: string): Promise<SessionBrief>;
}
export declare class MemoryManager {
    readonly project: ScopedMemoryStore;
    /** Global memory — uses EverOS when available, else local filesystem. */
    readonly global: MemoryBackend;
    private constructor();
    private initRanking;
    /** Store a memory entry in the given scope. */
    store(entry: MemoryEntry, scope: MemoryScope): Promise<void>;
    /** Retrieve memories matching the query from the given scope. */
    retrieve(query: MemoryQuery, scope: MemoryScope): Promise<MemoryResult[]>;
    /** List all memory entries in the given scope. */
    list(scope: MemoryScope, filter?: MemoryQuery): Promise<MemoryEntry[]>;
    /** Delete a memory by ID from the given scope. */
    delete(id: string, scope: MemoryScope): Promise<void>;
    /** Get a session brief from the given scope. */
    brief(sessionId: string, scope: MemoryScope): Promise<SessionBrief>;
    /** Get the internal store for a scope. */
    storeForScope(scope: MemoryScope): MemoryBackend;
    /**
     * Retrieve global memory as a system prompt section.
     * Used at session start for auto-mode decision guidance and dialog-mode risk alerts.
     */
    getGlobalMemoryGuidance(): Promise<string>;
    /** Get cold (unused) memory files from the given scope. */
    getColdMemories(scope?: MemoryScope): string[];
    /** Get hot (frequently accessed) memory files from the given scope. */
    getHotMemories(limit?: number, scope?: MemoryScope): string[];
    private static _instance;
    static instance(): MemoryManager;
    /** Reset singleton (for tests). */
    static reset(): void;
}
/** Convenience accessor for the singleton MemoryManager. */
export declare function getMemoryManager(): MemoryManager;
/** Minimal MemoryBackend compat — prefer using MemoryManager directly. */
export declare class LocalMemoryBackend implements MemoryBackend {
    private _store;
    constructor(scope?: MemoryScope);
    store(entry: MemoryEntry): Promise<void>;
    retrieve(query: MemoryQuery): Promise<MemoryResult[]>;
    list(filter?: MemoryQuery): Promise<MemoryEntry[]>;
    delete(id: string): Promise<void>;
    brief(sessionId: string): Promise<SessionBrief>;
}
//# sourceMappingURL=manager.d.ts.map