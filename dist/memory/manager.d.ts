/**
 * Memory Manager — unified memory backend interface.
 *
 * Provides a single API for storing, retrieving, listing, and deleting
 * memories. Default implementation uses the local filesystem
 * (.codesquad/memory/). Phase 2 adds EverOS MCP backend support.
 *
 * References:
 *   Idea/tutrue/memory-system-design.md §2.3.8
 */
import { type MemoryType } from './memory-types.js';
export interface MemoryEntry {
    id?: string;
    name: string;
    description: string;
    type: MemoryType;
    content: string;
    tags?: string[];
    created?: string;
    updated?: string;
    scope?: 'personal' | 'team';
}
export interface MemoryQuery {
    query?: string;
    type?: MemoryType;
    tags?: string[];
    scope?: 'personal' | 'team';
    limit?: number;
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
export interface MemoryBackend {
    store(entry: MemoryEntry): Promise<void>;
    retrieve(query: MemoryQuery): Promise<MemoryResult[]>;
    list(filter?: MemoryQuery): Promise<MemoryEntry[]>;
    delete(id: string): Promise<void>;
    brief(sessionId: string): Promise<SessionBrief>;
}
export declare class LocalMemoryBackend implements MemoryBackend {
    store(entry: MemoryEntry): Promise<void>;
    retrieve(query: MemoryQuery): Promise<MemoryResult[]>;
    list(filter?: MemoryQuery): Promise<MemoryEntry[]>;
    delete(_id: string): Promise<void>;
    brief(sessionId: string): Promise<SessionBrief>;
}
export declare function createMemoryManager(): MemoryBackend;
/** Get list of cold memories (not accessed in 30+ days). */
export declare function getColdMemories(): string[];
/** Get list of hot memories (most frequently accessed). */
export declare function getHotMemories(limit?: number): string[];
//# sourceMappingURL=manager.d.ts.map