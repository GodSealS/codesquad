/**
 * LSPTool — check a file for language server diagnostics (errors/warnings).
 *
 * After an Edit or Write, the agent can call this tool to verify
 * the file compiles cleanly before proceeding. Focused on TypeScript
 * via tsserver (typescript-language-server).
 *
 * References:
 *   Claude Code src/tools/LSPTool/LSPTool.ts (26KB)
 *
 * Phase 6 — P5 Vibe Coding
 */
import { z } from 'zod';
import { type Tool } from './types.js';
declare const InputSchema: z.ZodObject<{
    file_path: z.ZodString;
    waitForFresh: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
type Input = z.infer<typeof InputSchema>;
export declare const LSPTool: Tool<Input, Array<{
    line: number;
    character: number;
    message: string;
    severity: string;
}>>;
export {};
//# sourceMappingURL=LSPTool.d.ts.map