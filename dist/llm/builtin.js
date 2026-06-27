/**
 * Built-in LLM Provider definitions.
 *
 * Four built-in providers: Anthropic, OpenAI, DeepSeek, Kimi.
 * Phase 1.4 — Step 1.4.1.
 */
export const ANTHROPIC = {
    id: 'anthropic',
    name: 'Anthropic',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    models: [
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
        'claude-haiku-3-5',
    ],
    envVar: 'ANTHROPIC_API_KEY',
};
export const OPENAI = {
    id: 'openai',
    name: 'OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
    ],
    envVar: 'OPENAI_API_KEY',
};
export const DEEPSEEK = {
    id: 'deepseek',
    name: 'DeepSeek',
    protocol: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: [
        'deepseek-chat',
        'deepseek-coder',
        'deepseek-reasoner',
    ],
    envVar: 'DEEPSEEK_API_KEY',
};
export const KIMI = {
    id: 'kimi',
    name: 'Kimi (Moonshot)',
    protocol: 'openai-compatible',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'kimi-k2.6',
    models: [
        'kimi-k2.6',
    ],
    envVar: 'KIMI_API_KEY',
};
/** All built-in providers in registration order. */
export const BUILTIN_PROVIDERS = [
    ANTHROPIC,
    OPENAI,
    DEEPSEEK,
    KIMI,
];
//# sourceMappingURL=builtin.js.map