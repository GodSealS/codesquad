/**
 * Tool pairing guard — ensures tool_use/tool_result pairs are complete
 * before every LLM API call.
 *
 * S07 — Defensive Execution: prevents Anthropic API 400 errors caused by
 * missing or orphaned tool results.
 *
 * Three fix modes:
 *   Forward:  tool_use with no matching tool_result → insert synthetic error
 *   Reverse:  tool_result referencing a missing tool_use → remove orphan
 *   Dedup:    multiple tool_results referencing the same tool → keep first only
 */
import type { Message } from '../chat/session.js';
/**
 * Ensure every tool_use has a corresponding tool_result,
 * and every tool_result references a valid tool_use.
 *
 * Adapts to CodeSquad's text-prefix message format:
 *   tool_use:  <tool-call name="ToolName"> or [Tool: ToolName]
 *   tool_result: [Tool Result: ToolName] or [Tool Error: ToolName]
 *
 * @returns the cleaned message array and the number of fixes applied.
 */
export declare function ensureToolResultPairing(messages: Message[], knownToolNames: Set<string>): {
    messages: Message[];
    fixesApplied: number;
};
//# sourceMappingURL=pairing-guard.d.ts.map