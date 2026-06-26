/**
 * WebSearchTool — search the web for up-to-date information.
 *
 * Uses Brave Search API (free tier) as primary, falls back to DuckDuckGo HTML scraping.
 *
 * References:
 *   Claude Code src/tools/WebSearchTool/
 *
 * Feature 2 — P5 Vibe Coding
 */
import { z } from 'zod';
import { type Tool } from './types.js';
declare const InputSchema: z.ZodObject<{
    query: z.ZodString;
    maxResults: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
type Input = z.infer<typeof InputSchema>;
interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}
export declare const WebSearchTool: Tool<Input, SearchResult[]>;
export {};
//# sourceMappingURL=WebSearchTool.d.ts.map