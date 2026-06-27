/**
 * Token counting via js-tiktoken.
 *
 * Provides accurate token counting for major LLM providers.
 * Falls back to cl100k_base for unknown models.
 * Phase 1.3 — Step 1.3.1.
 */
import { getEncoding } from 'js-tiktoken';
// ── Model → tiktoken encoder mapping ──
const TOKENIZER_MAP = {
    'gpt-4o': 'o200k_base',
    'gpt-4o-mini': 'o200k_base',
    'gpt-4-turbo': 'cl100k_base',
    'gpt-4': 'cl100k_base',
    'gpt-3.5-turbo': 'cl100k_base',
    'claude-sonnet-4-20250514': 'cl100k_base', // Claude approximation
    'claude-opus-4-20250514': 'cl100k_base',
    'claude-haiku-3-5': 'cl100k_base',
    'deepseek-chat': 'cl100k_base',
    'deepseek-coder': 'cl100k_base',
    'deepseek-reasoner': 'cl100k_base',
    'kimi-k2.6': 'cl100k_base', // Kimi approximation
    'qwen-max': 'cl100k_base',
    'llama-3.1': 'cl100k_base',
    'ollama': 'cl100k_base',
};
const DEFAULT_ENCODER = 'cl100k_base';
// ── Encoder cache (singleton) ──
const encoderCache = new Map();
function getCachedEncoder(name) {
    let enc = encoderCache.get(name);
    if (!enc) {
        enc = getEncoding(name);
        encoderCache.set(name, enc);
    }
    return enc;
}
// ── Token count ──
export function countTokens(model, text) {
    const encoderName = TOKENIZER_MAP[model] ?? DEFAULT_ENCODER;
    return getCachedEncoder(encoderName).encode(text).length;
}
export function estimateTokenCount(messages, model) {
    let system = 0;
    let context = 0;
    let history = 0;
    for (const msg of messages) {
        const tokens = countTokens(model, msg.content);
        if (msg.role === 'system') {
            system += tokens;
        }
        else if (msg.isContext) {
            context += tokens;
        }
        else {
            history += tokens;
        }
    }
    return {
        system,
        context,
        history,
        total: system + context + history,
    };
}
//# sourceMappingURL=tokenizer.js.map