/**
 * Session Memory — background extraction of conversation summaries.
 *
 * Monitors token usage and tool calls during a REPL session.
 * When thresholds are met, extracts a concise summary to session-memory.md.
 * Used by memory-compact for context-aware conversation truncation.
 *
 * Triple guard:
 *   1. Only triggers on repl_main_thread (querySource check)
 *   2. Only triggers when autoCompact is enabled
 *   3. Fork recursion prevention via extraction-in-progress flag
 *
 * References:
 *   Claude Code src/services/SessionMemory/sessionMemory.ts
 *   Idea/tutrue/memory-system-design.md §2.3.3
 */
import type { Message } from '../chat/session.js';
/** Default config — aligned with Claude Code. */
export declare const DEFAULT_SESSION_MEMORY_CONFIG: SessionMemoryConfig;
export interface SessionMemoryConfig {
    /** Min total tokens before first extraction. */
    minimumMessageTokensToInit: number;
    /** Min token growth between extractions. */
    minimumTokensBetweenUpdate: number;
    /** Min tool calls between extractions. */
    toolCallsBetweenUpdates: number;
}
export type MemorySummaryMode = 'regex' | 'local-model' | 'online-model';
/**
 * Resolve the effective extractor based on mode setting and local availability.
 */
export declare function resolveSideQueryConfig(mode: MemorySummaryMode, defaultProvider: unknown): Promise<SideQueryConfig | null>;
/**
 * Extract structured key points from conversation using regex patterns.
 * (Scheme B — template matching)
 */
export declare function extractViaRegex(messages: Message[]): string;
/** Initialize session memory tracking for a session. */
export declare function initSessionMemory(sessionId: string): void;
/**
 * Check if session memory extraction should trigger.
 * @param sessionId - Current session ID
 * @param messages - All messages in the conversation
 * @param querySource - Source identifier (only 'repl_main_thread' triggers)
 * @param autoCompactEnabled - Whether auto-compact is enabled
 * @param config - Threshold configuration (defaults to Claude Code values)
 */
export declare function shouldExtractMemory(sessionId: string, messages: Message[], querySource: string, autoCompactEnabled: boolean, config?: SessionMemoryConfig): boolean;
/**
 * Record a tool call for session memory tracking.
 */
export declare function recordToolCall(sessionId: string): void;
/**
 * Mark extraction start (sets re-entrancy guard).
 */
export declare function markExtractionStarted(sessionId: string): void;
/**
 * Mark extraction complete and update token baseline.
 */
export declare function markExtractionCompleted(sessionId: string, messages: Message[]): void;
/**
 * Write a session memory summary to disk.
 */
export declare function writeSessionMemory(sessionId: string, projectRoot: string, summary: string): void;
/**
 * Read the current session memory summary.
 */
export declare function readSessionMemory(sessionId: string, projectRoot: string): string | null;
/**
 * Result of manual session memory extraction.
 */
export interface ManualExtractionResult {
    success: boolean;
    path: string;
    summary: string;
}
/** Reserved for future manual extraction trigger. */
export declare function manuallyExtractSessionMemory(_sessionId: string, _summary: string): Promise<ManualExtractionResult>;
/** Clean up state for a completed session. */
export declare function cleanupSessionMemory(sessionId: string): void;
/** Config for sideQuery extraction. */
export interface SideQueryConfig {
    provider: unknown;
    model: string;
}
/** Default sideQuery model (cheap, fast). */
export declare const SIDE_QUERY_MODEL = "deepseek-v4-flash";
/**
 * Extract session memory via configured mode.
 * - 'regex' → template matching (Scheme B, always works)
 * - 'local-model' → local Qwen 2.5 via Ollama (falls back to regex)
 * - 'online-model' → remote Flash model sideQuery (falls back to regex)
 *
 * Fire-and-forget — runs asynchronously, does not block the main conversation.
 */
export declare function extractSessionMemoryViaMode(messages: Message[], sessionId: string, projectRoot: string, config: SideQueryConfig | null): Promise<void>;
//# sourceMappingURL=session-memory.d.ts.map