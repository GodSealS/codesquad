/**
 * Agent LLM bridge — stores callLLM + runtimeConfig for AgentTool access.
 *
 * AgentTool.call() receives ToolUseContext but not the LLM caller.
 * This module bridges that gap — REPL injects via setAgentLLMBridge().
 *
 * Phase 6.1
 */
let _bridge = null;
export function setAgentLLMBridge(bridge) {
    _bridge = bridge;
}
export function getAgentLLMBridge() {
    return _bridge;
}
export function clearAgentLLMBridge() {
    _bridge = null;
}
//# sourceMappingURL=bridge.js.map