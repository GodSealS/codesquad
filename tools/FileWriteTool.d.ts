/**
 * FileWriteTool — write files with Read-then-Write enforcement.
 *
 * References:
 *   Claude Code src/tools/FileWriteTool/FileWriteTool.ts (435 lines)
 *
 * Phase 1.4
 */
import { z } from 'zod';
import { type Tool } from './types.js';
export declare const FileWriteInputSchema: z.ZodObject<{
    file_path: z.ZodString;
    content: z.ZodString;
}, z.core.$strip>;
export type FileWriteInput = z.infer<typeof FileWriteInputSchema>;
export declare const FileWriteTool: Tool<FileWriteInput, {
    filePath: string;
    bytesWritten: number;
    isNew: boolean;
}>;
//# sourceMappingURL=FileWriteTool.d.ts.map