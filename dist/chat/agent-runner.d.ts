/**
 * Agent Runner — core agent execution loop extracted from REPL index.ts.
 *
 * Used by both the CLI REPL (src/repl/index.ts) and the HTTP API (src/api/routes/chat.ts).
 *
 * References:
 *   Claude Code src/tools/AgentTool/runAgent.ts (35KB)
 *   CodeSquad src/repl/index.ts sendToAgent() (~240 lines)
 */
import type { Session } from '../chat/session.js';
import { type QueueProgress } from '../tools/execution-queue.js';
import type { ChatMode } from '../repl/mode.js';
import type { RuntimeProviderConfig } from '../llm/provider.js';
export interface AgentRunConfig {
    agentName: string;
    userInput: string;
    session: Session;
    providerId: string;
    modelId: string;
    projectRoot: string;
    aicoreDir: string;
    mode: ChatMode;
    maxTurns?: number;
    /** UI language: "zh" | "en". Determines AI response language. */
    lang?: string;
    /** Thinking mode: fast (no reasoning), think (medium), deep (extended). */
    thinkingMode?: 'fast' | 'think' | 'deep';
    /**
     * Query source identifier for Session Memory extraction guard.
     * Only 'repl_main_thread' triggers automatic extraction.
     * Sub-agents and fork sessions use different identifiers to prevent recursion.
     */
    querySource?: string;
    /** Memory summary mode: 'regex' | 'local-model' | 'online-model'. Default from settings. */
    memorySummaryMode?: 'regex' | 'local-model' | 'online-model';
    /**
     * Optional: provide a pre-resolved RuntimeProviderConfig directly.
     * When set, bypasses buildRuntimeConfig() registry lookup.
     * Used by the Web HTTP API to route through models.config.yaml sources.
     */
    runtimeConfig?: RuntimeProviderConfig;
    /**
     * Enable streaming token output (turn 1 only, mirrors Claude Code pattern).
     * Subsequent tool-execution turns use non-streaming for reliability.
     */
    stream?: boolean;
    /** Called for each streaming token (only when stream: true). */
    onToken?: (text: string) => void;
    /** Called for each thinking/reasoning token (only when stream: true and thinking mode active). */
    onThinking?: (text: string) => void;
    /** Called at each LLM turn with the assistant's response text. */
    onTurn?: (turn: number, response: string, toolCalls?: Array<{
        name: string;
        input: Record<string, unknown>;
    }>) => void;
    /** Called when a tool is about to be executed. */
    onToolUse?: (toolName: string, input: Record<string, unknown>, result: {
        content: string;
        isError: boolean;
    }) => void;
    /** Called with queue progress during tool batch execution (Web UI SSE). */
    onToolProgress?: (progress: QueueProgress) => void;
    /** Called when the agent encounters an error. */
    onError?: (message: string) => void;
}
export interface AgentRunResult {
    finalResponse: string;
    turnsUsed: number;
    toolCallsMade: number;
    error?: string;
    /** Total wall-clock duration from start to finish (milliseconds). */
    durationMs: number;
    /** Feature 1 (P5): Pending AskUserQuestion when agent needs user input. */
    needsUserInput?: {
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
    /** Phase 3: Tool needs user permission approval in headless ask mode. */
    needsApproval?: {
        toolName: string;
        toolCallId: string;
        input: Record<string, unknown>;
        message: string;
    };
}
export declare function runAgent(config: AgentRunConfig): Promise<AgentRunResult>;
//# sourceMappingURL=agent-runner.d.ts.map