/**
 * Agent execution runner — spawns a subagent with its own tool pool and context.
 *
 * References:
 *   Claude Code src/tools/AgentTool/runAgent.ts (35KB) — AsyncGenerator pattern
 *
 * Key design decisions (aligned with Claude Code):
 *   D1: Agent uses filtered tool pool (ALL_AGENT_DISALLOWED_TOOLS excluded)
 *   D2: Permission mode inheritance: parent bypassPermissions/acceptEdits cannot be overridden
 *   D3: Max turns from agent definition, capped at 20
 *   D4: SubagentStart/Stop hooks executed
 *
 * Phase 6.1
 */
import type { Session, Message, ModelConfig } from '../chat/session.js';
import type { Tool } from '../tools/types.js';
import type { AgentDefinition } from './definition.js';
import type { PermissionMode } from '../permissions/mode.js';
export interface AgentRunOptions {
    /** Agent definition from .codesquad/agents/ or built-in. */
    definition: AgentDefinition;
    /** The task/prompt to give the agent. */
    task: string;
    /** Parent session context. */
    parentSession: Session;
    /** Parent's model config (agent may override). */
    modelConfig: ModelConfig;
    /** Full tool pool available in the environment. */
    availableTools: readonly Tool[];
    /** Current permission mode (from parent). */
    parentPermissionMode: PermissionMode;
    /** Project root directory. */
    projectRoot: string;
    /** System prompt extra sections (project guidance, etc.) — from prompt builder. */
    systemPromptSections: string[];
    /** LLM caller — same signature as sendToAgent uses. */
    callLLM: (runtimeConfig: any, params: {
        model: string;
        messages: Array<{
            role: string;
            content: string;
        }>;
        maxTokens?: number;
        temperature?: number;
    }) => Promise<{
        content: string;
        usage?: {
            promptTokens: number;
            completionTokens: number;
        };
        model: string;
    }>;
    /** Runtime config for LLM calls. */
    runtimeConfig: any;
    /** Abort signal (shared with parent for synchronous agents). */
    abortSignal?: AbortSignal;
}
export interface AgentRunResult {
    /** Collected assistant messages from the agent. */
    messages: Message[];
    /** Summary of what the agent accomplished. */
    summary: string;
    /** Total turns taken. */
    turns: number;
    /** Whether the agent hit the max turns limit. */
    truncated: boolean;
    /** Token usage stats. */
    usage?: {
        promptTokens: number;
        completionTokens: number;
    };
}
/**
 * Run a subagent with its own tool pool and execute the task.
 *
 * This is an AsyncGenerator — yields messages as they come in.
 * Caller collects results via for-await-of or by calling runAgentToCompletion().
 */
export declare function runAgentStream(options: AgentRunOptions): AsyncGenerator<Message, AgentRunResult>;
/**
 * Run a subagent and return the collected result.
 * Convenience wrapper around runAgentStream.
 */
export declare function runAgent(options: AgentRunOptions): Promise<AgentRunResult>;
//# sourceMappingURL=runner.d.ts.map