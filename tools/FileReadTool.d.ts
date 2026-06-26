/**
 * FileReadTool — read files with line numbers, offset/limit pagination.
 *
 * References:
 *   Claude Code src/tools/FileReadTool/FileReadTool.ts (1184 lines)
 *
 * Phase 1.3
 */
import { z } from 'zod';
import { type Tool } from './types.js';
export declare const FileReadInputSchema: z.ZodObject<{
    file_path: z.ZodString;
    offset: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export type FileReadInput = z.infer<typeof FileReadInputSchema>;
export declare const FileReadTool: Tool<FileReadInput, {
    lines: string[];
    totalLines: number;
    filePath: string;
}>;
//# sourceMappingURL=FileReadTool.d.ts.map