/**
 * GrepTool + GlobTool — text search and file pattern matching.
 *
 * References:
 *   Claude Code src/tools/GrepTool/GrepTool.ts (577 lines)
 *   Claude Code src/tools/GlobTool/GlobTool.ts (198 lines)
 *
 * Phase 1.6
 */
import { z } from 'zod';
import { type Tool } from './types.js';
export declare const GrepInputSchema: z.ZodObject<{
    pattern: z.ZodString;
    path: z.ZodOptional<z.ZodString>;
    glob: z.ZodOptional<z.ZodString>;
    output_mode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        content: "content";
        count: "count";
        files_with_matches: "files_with_matches";
    }>>>;
    head_limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    multiline: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    case_insensitive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export type GrepInput = z.infer<typeof GrepInputSchema>;
export declare const GrepTool: Tool<GrepInput, {
    matches: string[];
    matchCount: number;
}>;
export declare const GlobInputSchema: z.ZodObject<{
    pattern: z.ZodString;
    path: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type GlobInput = z.infer<typeof GlobInputSchema>;
export declare const GlobTool: Tool<GlobInput, {
    files: string[];
    truncated: boolean;
}>;
//# sourceMappingURL=GrepGlobTool.d.ts.map