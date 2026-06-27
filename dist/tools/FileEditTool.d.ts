/**
 * FileEditTool — find-and-replace editing with exact string matching.
 *
 * Uses old_string/new_string replace model (NOT line numbers).
 * Multiple matches require replace_all flag or more context.
 *
 * References:
 *   Claude Code src/tools/FileEditTool/FileEditTool.ts (625 lines)
 *
 * Phase 1.5
 */
import { z } from 'zod';
import { type Tool } from './types.js';
export declare const FileEditInputSchema: z.ZodObject<{
    file_path: z.ZodString;
    old_string: z.ZodString;
    new_string: z.ZodString;
    replace_all: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export type FileEditInput = z.infer<typeof FileEditInputSchema>;
export declare const FileEditTool: Tool<FileEditInput, {
    filePath: string;
    replacements: number;
    diff: string;
}>;
//# sourceMappingURL=FileEditTool.d.ts.map