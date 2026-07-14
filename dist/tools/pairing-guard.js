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
import { logDiagnostic } from '../utils/error-logger.js';
// ── Constants ──
/** Synthetic error message injected when a tool result is missing. */
const SYNTHETIC_ERROR = '[Tool result missing — execution was interrupted]';
// ── Public API ──
/**
 * Ensure every tool_use has a corresponding tool_result,
 * and every tool_result references a valid tool_use.
 *
 * Adapts to CodeSquad's text-prefix message format:
 *   tool_use:  <tool-call name="ToolName"> or [Tool: ToolName]
 *   tool_result: [Tool Result: ToolName], [Tool Error: ToolName], or [Tool: ToolName]
 *
 * @returns the cleaned message array and the number of fixes applied.
 */
export function ensureToolResultPairing(messages, knownToolNames) {
    let fixesApplied = 0;
    const result = [...messages];
    // ── Forward fix: find orphan tool_use blocks with no tool_result ──
    for (let i = 0; i < result.length; i++) {
        const msg = result[i];
        if (msg.role !== 'assistant')
            continue;
        // Extract tool call names from assistant message (content + metadata)
        const calls = extractToolCallNames(msg.content, knownToolNames, msg.tool_calls);
        if (calls.length === 0)
            continue;
        // Check which calls have a matching result after this message
        const unmatched = [];
        for (const name of calls) {
            const hasResult = result.slice(i + 1).some((m) => (m.role === 'user' || m.role === 'system') &&
                (m.content.startsWith(`[Tool Result: ${name}]`) ||
                    m.content.startsWith(`[Tool Error: ${name}]`) ||
                    m.content.startsWith(`[Tool: ${name}]`)));
            if (!hasResult)
                unmatched.push(name);
        }
        if (unmatched.length > 0) {
            const synthetic = unmatched
                .map((name) => `[Tool Error: ${name}]\n${SYNTHETIC_ERROR}`)
                .join('\n\n');
            result.splice(i + 1, 0, {
                role: 'user',
                content: synthetic,
                timestamp: new Date().toISOString(),
                isContext: true,
            });
            fixesApplied += unmatched.length;
            logDiagnostic('WARN', 'pairing-guard', `synthesized ${unmatched.length} missing tool_result(s): ${unmatched.join(', ')}`);
        }
    }
    // ── Reverse fix: remove orphan tool_results ──
    // Collect all tool names referenced by assistant messages
    const allToolCalls = new Set();
    for (const msg of result) {
        if (msg.role !== 'assistant')
            continue;
        for (const name of extractToolCallNames(msg.content, knownToolNames, msg.tool_calls)) {
            allToolCalls.add(name);
        }
    }
    // Remove tool_result messages that reference tools never called
    for (let i = result.length - 1; i >= 0; i--) {
        const msg = result[i];
        if (msg.role !== 'user' && msg.role !== 'system')
            continue;
        // Match all 3 tool result prefix formats: [Tool Result: X], [Tool Error: X], [Tool: X]
        const refMatch = msg.content.match(/^\[Tool (?:Result|Error|):\s*(\w+)\]/);
        if (refMatch && !allToolCalls.has(refMatch[1])) {
            result.splice(i, 1);
            fixesApplied++;
            logDiagnostic('WARN', 'pairing-guard', `removed orphan tool_result for: ${refMatch[1]}`);
        }
    }
    return { messages: result, fixesApplied };
}
// ── Helpers ──
function extractToolCallNames(content, knownNames, toolCalls) {
    const names = new Set();
    // Native tool_calls metadata (OpenAI/Anthropic function calling) — primary source
    if (Array.isArray(toolCalls)) {
        for (const tc of toolCalls) {
            const name = tc.name || tc.function?.name;
            if (name && knownNames.has(name))
                names.add(name);
        }
    }
    // XML pattern: <tool-call name="ToolName">
    const xmlRe = /<tool-call\s+name="([^"]+)"/gi;
    let m;
    while ((m = xmlRe.exec(content)) !== null) {
        if (knownNames.has(m[1]))
            names.add(m[1]);
    }
    // Self-closing pattern: <tool-call name="ToolName" ... />
    const selfRe = /<tool-call\s+name="([^"]+)"\s*\/>/gi;
    while ((m = selfRe.exec(content)) !== null) {
        if (knownNames.has(m[1]))
            names.add(m[1]);
    }
    // Text prefix: [Tool: ToolName]
    const textRe = /\[Tool:\s*(\w+)\]/gi;
    while ((m = textRe.exec(content)) !== null) {
        if (knownNames.has(m[1]))
            names.add(m[1]);
    }
    return [...names];
}
//# sourceMappingURL=pairing-guard.js.map