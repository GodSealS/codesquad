/**
 * Dynamic token budget management.
 *
 * Computes available context tokens based on model window size,
 * reserve for output, and system prompt consumption.
 * Phase 1.3 — Step 1.3.2.
 */
import { countTokens } from './tokenizer.js';
// ── Model window sizes ──
const MODEL_WINDOWS = {
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-4-turbo': 128000,
    'gpt-4': 8192,
    'gpt-3.5-turbo': 16385,
    'claude-sonnet-4-20250514': 200000,
    'claude-opus-4-20250514': 200000,
    'claude-haiku-3-5': 200000,
    'deepseek-chat': 128000,
    'deepseek-coder': 128000,
    'deepseek-reasoner': 128000,
    'kimi-k2.6': 128000,
};
const DEFAULT_WINDOW = 128000;
const DEFAULT_OUTPUT_RESERVE = 4096;
// ── Compute budget ──
export function computeBudget(model, systemPrompt) {
    const modelMax = MODEL_WINDOWS[model] ?? DEFAULT_WINDOW;
    const systemTokens = countTokens(model, systemPrompt);
    const outputReserve = DEFAULT_OUTPUT_RESERVE;
    return {
        modelMaxTokens: modelMax,
        outputReserve,
        systemPromptTokens: systemTokens,
        availableForContext: Math.max(0, modelMax - outputReserve - systemTokens),
    };
}
// ── Compression strategy ──
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
export function compressMessages(messages, model, maxTokens, keepRecent = 10) {
    if (messages.length === 0)
        return messages;
    // Separate system/context from conversation
    const system = messages.filter((m) => m.role === 'system');
    const context = messages.filter((m) => m.isContext);
    const conversation = messages.filter((m) => m.role !== 'system' && !m.isContext);
    // Always keep recent messages
    const recent = conversation.slice(-keepRecent);
    const older = conversation.slice(0, -keepRecent);
    // Compute tokens used by system + context + recent
    const fixedMessages = [...system, ...context, ...recent];
    const fixedTokens = fixedMessages.reduce((sum, m) => sum + countTokens(model, m.content), 0);
    const available = maxTokens - fixedTokens;
    if (available <= 0) {
        // Even recent messages don't fit — keep only the most recent ones
        let kept = recent;
        let total = 0;
        const result = [...system, ...context];
        for (let i = kept.length - 1; i >= 0; i--) {
            const t = countTokens(model, kept[i].content);
            if (total + t <= maxTokens) {
                result.unshift(kept[i]);
                total += t;
            }
        }
        return result;
    }
    // Add truncated older messages (first 200 chars each)
    const result = [...system, ...context];
    let remaining = available;
    for (const msg of older) {
        const truncated = msg.content.slice(0, 200) + (msg.content.length > 200 ? '...' : '');
        const t = countTokens(model, truncated);
        if (remaining >= t) {
            result.push({ ...msg, content: truncated });
            remaining -= t;
        }
        else {
            break;
        }
    }
    // Add recent messages
    result.push(...recent);
    return result;
}
//# sourceMappingURL=budget.js.map