import { z } from 'zod';
/** Canonical HTTP input for both JSON and SSE chat endpoints. */
export declare const ChatRequestSchema: z.ZodObject<{
    prompt: z.ZodString;
    history: z.ZodOptional<z.ZodArray<z.ZodObject<{
        sender: z.ZodEnum<{
            user: "user";
            assistant: "assistant";
        }>;
        content: z.ZodString;
        timestamp: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>>;
    modelName: z.ZodOptional<z.ZodString>;
    agentId: z.ZodOptional<z.ZodString>;
    skillId: z.ZodOptional<z.ZodString>;
    commandId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    mode: z.ZodOptional<z.ZodEnum<{
        ask: "ask";
        craft: "craft";
        plan: "plan";
        Ask: "Ask";
        Craft: "Craft";
        Plan: "Plan";
    }>>;
    lang: z.ZodOptional<z.ZodEnum<{
        en: "en";
        zh: "zh";
    }>>;
    thinkingMode: z.ZodOptional<z.ZodEnum<{
        fast: "fast";
        think: "think";
        deep: "deep";
    }>>;
    searchProvider: z.ZodOptional<z.ZodEnum<{
        auto: "auto";
        brave: "brave";
        duckduckgo: "duckduckgo";
        bing: "bing";
        google: "google";
    }>>;
    memorySummaryMode: z.ZodOptional<z.ZodEnum<{
        regex: "regex";
        "local-model": "local-model";
        "online-model": "online-model";
    }>>;
    attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        content: z.ZodString;
        type: z.ZodString;
    }, z.core.$strict>>>;
    generationConfig: z.ZodOptional<z.ZodObject<{
        temperature: z.ZodOptional<z.ZodNumber>;
        maxTokens: z.ZodOptional<z.ZodNumber>;
        topP: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
/**
 * Accept the pre-contract API shape for one compatibility window while
 * keeping provider configuration and all other unknown fields rejected.
 */
export declare function normalizeChatRequest(input: unknown): z.ZodSafeParseResult<{
    prompt: string;
    history?: {
        sender: "user" | "assistant";
        content: string;
        timestamp?: string | undefined;
    }[] | undefined;
    modelName?: string | undefined;
    agentId?: string | undefined;
    skillId?: string | undefined;
    commandId?: string | undefined;
    sessionId?: string | undefined;
    mode?: "ask" | "craft" | "plan" | "Ask" | "Craft" | "Plan" | undefined;
    lang?: "en" | "zh" | undefined;
    thinkingMode?: "fast" | "think" | "deep" | undefined;
    searchProvider?: "auto" | "brave" | "duckduckgo" | "bing" | "google" | undefined;
    memorySummaryMode?: "regex" | "local-model" | "online-model" | undefined;
    attachments?: {
        name: string;
        content: string;
        type: string;
    }[] | undefined;
    generationConfig?: {
        temperature?: number | undefined;
        maxTokens?: number | undefined;
        topP?: number | undefined;
    } | undefined;
}>;
//# sourceMappingURL=chat.d.ts.map