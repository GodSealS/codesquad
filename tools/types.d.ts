/**
 * Tool system types — aligned with Claude Code's Tool interface.
 *
 * References:
 *   Claude Code src/Tool.ts (29KB) — Tool interface design
 *   Claude Code src/tools/toolExecution.ts — execution chain
 *
 * Phase 1.0
 */
import type { z } from 'zod';
import type { Message, Session } from '../chat/session.js';
import type { PermissionMode } from '../permissions/mode.js';
export interface ToolCall {
    id: string;
    name: string;
    input: Record<string, unknown>;
}
export interface ToolResult<Output = unknown> {
    toolCallId: string;
    output: Output;
    content: string;
    isError?: boolean;
    /** Additional messages to inject into conversation (e.g. context attachments). */
    newMessages?: Message[];
    /** Session context modifications from tool results. */
    contextModifier?: Partial<Session['context']>;
    /** When true, the tool requires user approval before execution (headless ask mode). */
    needsApproval?: boolean;
}
export interface ValidationResult {
    valid: boolean;
    message?: string;
    errorCode?: string;
}
export interface PermissionResult {
    behavior: 'allow' | 'deny' | 'ask';
    message?: string;
    updatedInput?: Record<string, unknown>;
}
/**
 * Aggregated context passed to every tool's call() method.
 * Aligns with Claude Code's ToolUseContext (~300 lines).
 */
export interface ToolUseContext {
    /** Active session. */
    session: Session;
    /** Current working directory. */
    cwd: string;
    /** Project root directory. */
    projectRoot: string;
    /** AICore installation directory (CLI package root). Fallback for file reads. */
    aicoreDir?: string;
    /** Abort signal for cancellation. */
    abortSignal: AbortSignal;
    /** Current permission mode (affects permission checks). */
    permissionMode: PermissionMode;
    /** File read state cache — shared across tool invocations. */
    readFileState: ReadFileStateCache;
    /** Whether this is a headless/non-interactive run. */
    headless: boolean;
    /** Optional progress callback. */
    onProgress?: (message: string) => void;
    /** Internal: set by AskUserQuestionTool to signal pending user question. */
    __needsUserInput?: {
        toolCallId: string;
        questions: Array<{
            question: string;
            header: string;
            options: Array<{
                label: string;
                description: string;
            }>;
            multiSelect?: boolean;
        }>;
    };
}
export interface ReadFileEntry {
    filePath: string;
    content: string;
    mtimeMs: number;
    contentHash: string;
    readAt: number;
}
export interface ReadFileStateCache {
    get(filePath: string): ReadFileEntry | undefined;
    set(filePath: string, entry: ReadFileEntry): void;
    has(filePath: string): boolean;
    clear(): void;
}
/**
 * Complete Tool interface — every tool MUST implement these methods.
 * Based on Claude Code's Tool<Input, Output>.
 */
export interface Tool<Input = Record<string, unknown>, Output = unknown> {
    /** Unique tool name (e.g. "Bash", "Read", "Write", "Edit"). */
    readonly name: string;
    /** Deprecated alias names — redirect to this tool. e.g. ["KillShell", "BashOutput"]. */
    readonly aliases?: string[];
    /** Human-readable description shown in /help and tool listing. */
    readonly description: string;
    /** 3-10 word search hint for tab-completion / fuzzy matching. */
    readonly searchHint: string;
    /** Zod schema for input validation. */
    readonly inputSchema: z.ZodType<Input>;
    /** Generate the system-prompt description the model sees. */
    prompt(): string;
    /** Generate a human-readable description of a specific invocation. */
    descriptionFor(input: Input): string;
    /** Whether this tool is enabled (feature-gated or context-dependent). */
    isEnabled(context: ToolUseContext): boolean;
    /** Whether this tool only reads — safe to allow in Plan mode. */
    isReadOnly(): boolean;
    /** Whether multiple invocations can run concurrently. */
    isConcurrencySafe(): boolean;
    /** Whether this tool performs destructive operations (write, delete, execute). */
    isDestructive(): boolean;
    /**
     * Validate raw input before permission checks.
     * Called BEFORE checkPermissions(). Should reject obviously invalid input.
     */
    validateInput(input: Input, context: ToolUseContext): ValidationResult;
    /**
     * Permission check — may inspect input and context.
     * Uses permission rules from settings.json (allow/deny/ask).
     */
    checkPermissions(input: Input, context: ToolUseContext): PermissionResult;
    /**
     * Execute the tool. Called only after validateInput + checkPermissions pass.
     */
    call(input: Input, context: ToolUseContext): Promise<ToolResult<Output>>;
    /** Max size of tool result before persisting to file (in characters). */
    readonly maxResultSizeChars: number;
}
/**
 * Loose version of Tool where some methods are optional.
 * buildTool() fills in fail-closed defaults.
 */
export type ToolDef<Input = Record<string, unknown>, Output = unknown> = {
    name: string;
    description: string;
    searchHint: string;
    inputSchema: z.ZodType<Input>;
    prompt: () => string;
    descriptionFor: (input: Input) => string;
    call: (input: Input, context: ToolUseContext) => Promise<ToolResult<Output>>;
} & Partial<Pick<Tool<Input, Output>, 'aliases' | 'isEnabled' | 'isReadOnly' | 'isConcurrencySafe' | 'isDestructive' | 'validateInput' | 'checkPermissions' | 'maxResultSizeChars'>>;
/**
 * Build a complete Tool from a ToolDef.
 * Fills missing methods with fail-closed defaults.
 * Mirrors Claude Code's buildTool() spread pattern.
 */
export declare function buildTool<Input = Record<string, unknown>, Output = unknown>(def: ToolDef<Input, Output>): Tool<Input, Output>;
export type Tools = readonly Tool[];
export interface PermissionRule {
    toolName: string;
    contentPattern?: string;
}
export type PermissionBehavior = 'allow' | 'deny' | 'ask';
export interface ResolvedPermissionRule extends PermissionRule {
    behavior: PermissionBehavior;
    source: string;
}
/**
 * Parse a permission rule string like "Bash(git *)" or "Read(*.ts)".
 */
export declare function parsePermissionRule(raw: string): PermissionRule | null;
/**
 * Check if a tool invocation matches a permission rule.
 */
export declare function matchesRule(rule: PermissionRule, toolName: string, toolInput?: Record<string, unknown>): boolean;
//# sourceMappingURL=types.d.ts.map