/**
 * LLM Client Types
 *
 * Shared types for LLM provider abstraction layer.
 * Supports Anthropic, OpenAI-compatible, DeepSeek, Kimi, and custom endpoints.
 */
/** Provider base URL defaults (hardcoded per D-15) */
export const PROVIDER_DEFAULTS = {
    anthropic: { baseUrl: 'https://api.anthropic.com' },
    openai: { baseUrl: 'https://api.openai.com/v1' },
    'openai-compatible': { baseUrl: 'https://api.openai.com/v1' },
    deepseek: { baseUrl: 'https://api.deepseek.com/v1' },
    kimi: { baseUrl: 'https://api.moonshot.cn/v1' },
};
//# sourceMappingURL=types.js.map