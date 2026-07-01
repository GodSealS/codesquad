/**
 * Agent Runner — Tool-Call Loop Execution Engine
 *
 * Implements the full agentic execution cycle:
 * 1. Load agent prompt template from .codesquad/
 * 2. Inject context + input → build system prompt
 * 3. Enter tool-call loop (up to maxTurns)
 * 4. Call LLM API, execute tool calls, feed results back
 * 5. Return structured result
 *
 * Stateless: holds no API keys, session state, or context.
 */
import type { ModelConfig } from '../llm/types.js';
export interface AgentInvokeArgs {
    name: string;
    input?: Record<string, unknown>;
    context?: {
        gdd?: string;
        code?: string;
        references?: string[];
        workspace_root?: string;
    };
    history?: Array<{
        role: string;
        content: string;
    }>;
    model_config: ModelConfig;
    tools?: string[];
}
export interface AgentInvokeResult {
    success: boolean;
    output: {
        text: string;
        files_written?: string[];
        tool_calls?: Array<{
            name: string;
            args: Record<string, unknown>;
            result: unknown;
        }>;
    };
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        cost_estimate: number;
    };
    turns_used: number;
    error?: string;
}
export declare function runAgent(projectRoot: string, args: AgentInvokeArgs): Promise<AgentInvokeResult>;
//# sourceMappingURL=agent-runner.d.ts.map