/**
 * SkillInstance — represents a single running skill execution.
 *
 * Each skill invocation (whether from REPL /skill-name or Web API skillId)
 * creates a SkillInstance. Instances support:
 *   - Unique ID for tracking
 *   - Step-by-step execution with decision checkpoints
 *   - Pause/resume when user input is needed (AskUserQuestion)
 *   - Multiple concurrent instances per skill
 *   - Error propagation with diagnostic info
 */
import type { Session } from '../chat/session.js';
import type { ChatMode } from '../repl/mode.js';
import type { RuntimeProviderConfig } from '../llm/provider.js';
import type { LoadedSkill } from '../repl/skill-registry.js';
export type InstanceStatus = 'idle' | 'running' | 'awaiting_user' | 'completed' | 'failed' | 'cancelled';
export interface AskUserQuestion {
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
}
export interface InstanceError {
    message: string;
    stack?: string;
    isLlmError: boolean;
    statusCode?: number;
}
/** Events emitted during skill step-by-step execution. */
export interface SkillStepEvent {
    type: 'thinking' | 'text' | 'tool_call' | 'tool_result' | 'question' | 'done' | 'error';
    instanceId: string;
    skillName: string;
    turn: number;
    /** Current response text (accumulated). */
    text?: string;
    /** Tool being called. */
    toolName?: string;
    toolInput?: Record<string, unknown>;
    /** Tool result content. */
    toolResult?: string;
    toolIsError?: boolean;
    /** Pending user question — execution pauses here. */
    question?: AskUserQuestion;
    /** Final content when done. */
    finalContent?: string;
    totalTurns?: number;
    /** Error diagnostic. */
    error?: InstanceError;
}
export interface SkillInstanceConfig {
    skill: LoadedSkill;
    skillArgs: string;
    model: string;
    providerId: string;
    runtimeConfig: RuntimeProviderConfig;
    projectRoot: string;
    cwd?: string;
    mode: ChatMode;
    lang?: string;
    maxTurns?: number;
    maxTokensOverride?: number;
    /** Parent agent name — for capability skills bound to an agent. */
    parentAgent?: string;
    /** Called for each step event. */
    onStep?: (event: SkillStepEvent) => void;
}
export declare class SkillInstance {
    readonly id: string;
    readonly skillName: string;
    readonly skill: LoadedSkill;
    readonly session: Session;
    status: InstanceStatus;
    private config;
    private messages;
    private turn;
    private consecutiveTruncations;
    private lastCompletionTokens;
    private emptyToolCallCount;
    private finalContent;
    private runtimeConfig;
    private pool;
    private nativeTools;
    private toolContext;
    private systemMessages;
    private abortController;
    private _totalPromptTokens;
    private _totalCompletionTokens;
    private _totalCost;
    /** Total prompt tokens used across all turns. */
    get totalPromptTokens(): number;
    /** Total completion tokens used across all turns. */
    get totalCompletionTokens(): number;
    /** Total cost in USD. */
    get totalCost(): number;
    private _pendingQuestion;
    private _resolveResume;
    /** The current execution promise (used for re-await on resume). */
    private _executionPromise;
    error: InstanceError | null;
    /** Assembled skill body — main SKILL.md + matched sub-files based on user context. */
    readonly assembledBody: string;
    constructor(config: SkillInstanceConfig);
    /** Start execution. Returns when done or paused for user input. */
    execute(): Promise<void>;
    /**
     * Resume execution after user answers a question.
     * Sets status back to 'running' so the suspended _runLoop's while condition passes.
     * @param answer - User's text answer (comma-separated option indices or text).
     */
    resume(answer: string): void;
    /** Cancel execution. */
    cancel(): void;
    /** Get current pending question (for UI to display). */
    get pendingQuestion(): AskUserQuestion | null;
    private _runLoop;
    /**
     * Assemble the full skill body by matching sub-files against user context.
     *
     * For multi-file skills like cocos_editor:
     *   User says "create a player character" → auto-loads workflow-character.md
     *   User says "build the UI" → auto-loads workflow-ui.md
     *
     * The matching uses trigger keywords from the SKILL.md's Workflow Routing table.
     */
    private _assembleBody;
    private _emit;
}
//# sourceMappingURL=instance.d.ts.map