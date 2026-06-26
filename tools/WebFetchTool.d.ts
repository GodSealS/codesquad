/**
 * WebFetchTool — fetch and extract text content from a URL.
 *
 * Downloads the HTML page and extracts readable text content.
 * Does not execute JavaScript.
 *
 * References:
 *   Claude Code src/tools/WebFetchTool/
 *
 * Feature 2 — P5 Vibe Coding
 */
import { z } from 'zod';
import { type Tool } from './types.js';
declare const InputSchema: z.ZodObject<{
    url: z.ZodString;
    maxChars: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    extractMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        text: "text";
        auto: "auto";
        markdown: "markdown";
    }>>>;
}, z.core.$strip>;
type Input = z.infer<typeof InputSchema>;
export declare const WebFetchTool: Tool<Input, string>;
export {};
//# sourceMappingURL=WebFetchTool.d.ts.map