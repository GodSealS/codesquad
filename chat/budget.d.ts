/**
 * Dynamic token budget management.
 *
 * Computes available context tokens based on model window size,
 * reserve for output, and system prompt consumption.
 * Phase 1.3 — Step 1.3.2.
 */
import type { Message } from './session.js';
export interface TokenBudget {
    modelMaxTokens: number;
    outputReserve: number;
    systemPromptTokens: number;
    availableForContext: number;
}
export declare function computeBudget(model: string, systemPrompt: string): TokenBudget;
/**
 * Compress session messages to fit within the token budget.
 *
 * Priority:
 *   1. Keep system prompt (not included in messages — handled separately)
 *   2. Keep last N recent messages intact (N = keepRecent)
 *   3. Truncate older messages (keep first 200 chars)
 *   4. Drop very old messages beyond maxMessages
 *
 * v1: Hard truncation. v2 will add LLM-generated summaries.
 */
export declare function compressMessages(messages: Message[], model: string, maxTokens: number, keepRecent?: number): Message[];
//# sourceMappingURL=budget.d.ts.map