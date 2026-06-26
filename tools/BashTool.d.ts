/**
 * BashTool — execute shell commands with safety constraints.
 *
 * v2 Upgrade:
 *   - exec() → spawn() for proper process tree management
 *   - Platform-specific tree-kill (taskkill on Win, SIGTERM/SIGKILL on Unix)
 *   - Timeout auto-backgrounding (command continues running if it times out)
 *   - Output persistence (large output → temp file, returns file path)
 *   - Progress callbacks via onProgress
 *
 * References:
 *   Claude Code src/tools/BashTool/BashTool.ts (820+ lines)
 *   Claude Code src/utils/Shell.ts
 *
 * Phase 2.0
 */
import { z } from 'zod';
import { type Tool } from './types.js';
export declare const BashInputSchema: z.ZodObject<{
    command: z.ZodString;
    timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    description: z.ZodOptional<z.ZodString>;
    runInBackground: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export type BashInput = z.infer<typeof BashInputSchema>;
export interface BackgroundTask {
    taskId: string;
    pid: number;
    command: string;
    startedAt: number;
    status: 'running' | 'completed' | 'killed';
}
export declare function getBackgroundTasks(): BackgroundTask[];
export declare const BashTool: Tool<BashInput, {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    backgroundTaskId?: string;
    outputFilePath?: string;
    backgrounded?: boolean;
}>;
export declare function invalidatePermissionRules(): void;
//# sourceMappingURL=BashTool.d.ts.map