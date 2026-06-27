/**
 * AskUserQuestionTool — allow agents to ask the user clarifying questions.
 *
 * When information is insufficient, the agent can pause execution and ask
 * the user structured questions. This prevents guess-driven errors.
 *
 * References:
 *   Claude Code src/tools/AskUserQuestionTool/
 *
 * Feature 1 — P5 Vibe Coding
 */
import { z } from 'zod';
import { type Tool } from './types.js';
declare const InputSchema: z.ZodObject<{
    questions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        question: z.ZodString;
        header: z.ZodString;
        options: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            description: z.ZodString;
        }, z.core.$strip>>;
        multiSelect: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>>>;
    answers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
type Input = z.infer<typeof InputSchema>;
export declare const AskUserQuestionTool: Tool<Input, any>;
export {};
//# sourceMappingURL=AskUserQuestionTool.d.ts.map