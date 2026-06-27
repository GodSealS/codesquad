/**
 * Token counting via js-tiktoken.
 *
 * Provides accurate token counting for major LLM providers.
 * Falls back to cl100k_base for unknown models.
 * Phase 1.3 — Step 1.3.1.
 */
import type { Message } from './session.js';
export declare function countTokens(model: string, text: string): number;
export interface TokenCount {
    system: number;
    context: number;
    history: number;
    total: number;
}
export declare function estimateTokenCount(messages: Message[], model: string): TokenCount;
//# sourceMappingURL=tokenizer.d.ts.map