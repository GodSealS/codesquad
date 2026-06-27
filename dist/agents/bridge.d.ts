/**
 * Agent LLM bridge — stores callLLM + runtimeConfig for AgentTool access.
 *
 * AgentTool.call() receives ToolUseContext but not the LLM caller.
 * This module bridges that gap — REPL injects via setAgentLLMBridge().
 *
 * Phase 6.1
 */
type LlmCaller = (runtimeConfig: any, params: {
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
interface AgentLLMBridge {
    callLLM: LlmCaller;
    runtimeConfig: any;
}
export declare function setAgentLLMBridge(bridge: AgentLLMBridge): void;
export declare function getAgentLLMBridge(): AgentLLMBridge | null;
export declare function clearAgentLLMBridge(): void;
export {};
//# sourceMappingURL=bridge.d.ts.map