import { z } from 'zod';
const MessageSchema = z.object({
    sender: z.enum(['user', 'assistant']),
    content: z.string(),
    timestamp: z.string().optional(),
}).strict();
/** Canonical HTTP input for both JSON and SSE chat endpoints. */
export const ChatRequestSchema = z.object({
    prompt: z.string().min(1).max(200_000),
    // Accept any length; server truncates to last 20 before injection
    history: z.array(MessageSchema).optional(),
    modelName: z.string().min(1).max(200).optional(),
    agentId: z.string().min(1).max(64).optional(),
    skillId: z.string().min(1).max(64).optional(),
    commandId: z.string().min(1).max(64).optional(),
    sessionId: z.string().min(1).max(128).optional(),
    mode: z.enum(['ask', 'craft', 'plan', 'Ask', 'Craft', 'Plan']).optional(),
    lang: z.enum(['zh', 'en']).optional(),
    thinkingMode: z.enum(['fast', 'think', 'deep']).optional(),
    searchProvider: z.enum(['auto', 'brave', 'duckduckgo', 'bing', 'google']).optional(),
    memorySummaryMode: z.enum(['regex', 'local-model', 'online-model']).optional(),
    attachments: z.array(z.object({
        name: z.string().min(1).max(255),
        content: z.string(),
        type: z.string().min(1).max(128),
    }).strict()).max(10).optional(),
    generationConfig: z.object({
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().int().min(1).max(100_000).optional(),
        topP: z.number().min(0).max(1).optional(),
    }).strict().optional(),
}).strict();
const LEGACY_CHAT_FIELDS = new Set([
    'agentName', 'message', 'model', 'sessionId', 'mode',
]);
/**
 * Accept the pre-contract API shape for one compatibility window while
 * keeping provider configuration and all other unknown fields rejected.
 */
export function normalizeChatRequest(input) {
    const canonical = ChatRequestSchema.safeParse(input);
    if (canonical.success || !input || typeof input !== 'object' || Array.isArray(input)) {
        return canonical;
    }
    const raw = input;
    const allowed = new Set([...Object.keys(ChatRequestSchema.shape), ...LEGACY_CHAT_FIELDS]);
    if (Object.keys(raw).some((key) => !allowed.has(key)) || 'customSources' in raw) {
        return canonical;
    }
    if (typeof raw.agentName !== 'string' || typeof raw.message !== 'string') {
        return canonical;
    }
    return ChatRequestSchema.safeParse({
        prompt: raw.message,
        agentId: raw.agentName,
        modelName: typeof raw.model === 'string' ? raw.model : undefined,
        sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : undefined,
        mode: raw.mode,
    });
}
//# sourceMappingURL=chat.js.map