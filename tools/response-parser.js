/**
 * Response Parser — extract tool calls from LLM responses.
 *
 * Two strategies:
 *   Strategy 1 (Primary): Native tool_use blocks (Anthropic API / OpenAI function calls)
 *   Strategy 2 (Fallback): XML <tool-call> tags (for non-native providers like Ollama)
 *
 * References:
 *   Claude Code src/query.ts — msgToolUseBlocks extraction
 *
 * Feature 1.3 — P4 Tool Use native mechanism
 */
import { findTool } from './registry.js';
// ── Main Parser ──
/**
 * Parse tool calls from an LLM response.
 *
 * Strategy 1: Native tool_use blocks (preferred, for Anthropic/OpenAI)
 * Strategy 2: XML <tool-call> tags (fallback for non-native providers)
 *
 * @param rawContentBlocks - API-specific content blocks (Anthropic) or tool_calls array (OpenAI)
 * @param textContent - Raw text content (for XML fallback)
 * @param availableTools - Optional set of valid tool names to filter against
 */
export function parseToolCalls(rawContentBlocks, textContent, availableTools) {
    // Strategy 1: Native tool_use blocks
    // Mirrors Claude Code query.ts: filter content.type === 'tool_use' across ALL blocks
    // Don't just check the first block — mixed content (text + tool_use) is common
    if (Array.isArray(rawContentBlocks) && rawContentBlocks.length > 0) {
        const blocks = rawContentBlocks;
        // Strategy 1a: Anthropic content blocks — check if ANY block has type 'tool_use'
        const hasToolUse = blocks.some((b) => b.type === 'tool_use');
        if (hasToolUse) {
            return extractAnthropicToolCalls(rawContentBlocks);
        }
        // Strategy 1b: OpenAI tool_calls — check if ANY block has .function (OpenAI format)
        const isOpenAI = blocks.some((b) => b.type === 'function' && typeof b.function === 'object');
        if (isOpenAI) {
            return extractOpenAIToolCalls(rawContentBlocks);
        }
    }
    // Strategy 2: XML fallback (for non-native providers like Ollama)
    return extractXmlToolCalls(textContent, availableTools);
}
// ── Anthropic Parser ──
/**
 * Extract tool_use blocks from Anthropic API response content array.
 * Mirrors Claude Code's msgToolUseBlocks filter.
 */
export function extractAnthropicToolCalls(contentBlocks) {
    const results = [];
    for (const block of contentBlocks) {
        if (block.type === 'tool_use' && block.name) {
            results.push({
                id: block.id || generateToolCallId(block.name),
                name: block.name,
                input: block.input || {},
            });
        }
    }
    return filterValidTools(results);
}
// ── OpenAI Parser ──
/**
 * Extract function calls from OpenAI API response.
 */
export function extractOpenAIToolCalls(toolCalls) {
    const results = [];
    for (const tc of toolCalls) {
        if (tc.type !== 'function')
            continue;
        let input = {};
        try {
            input = JSON.parse(tc.function.arguments);
        }
        catch {
            input = { _raw: tc.function.arguments };
        }
        results.push({
            id: tc.id || generateToolCallId(tc.function.name),
            name: tc.function.name,
            input,
        });
    }
    return filterValidTools(results);
}
// ── XML Fallback Parser ──
/**
 * Extract tool calls from XML-format text content.
 * Pattern: <tool-call name="ToolName">{"key":"value"}</tool-call>
 * Also supports self-closing: <tool-call name="ToolName" />
 *
 * This is the legacy extraction method, kept as fallback for:
 * - Ollama and other non-native providers
 * - LLMs that don't support native tool_use parameters
 */
export function extractXmlToolCalls(content, availableTools) {
    const results = [];
    // Pattern 1a: <tool-call name="ToolName">{"key":"value"}</tool-call>
    const toolPattern = /<tool-call\s+name="([^"]+)"\s*>([\s\S]*?)<\/tool-call>/gi;
    let match;
    while ((match = toolPattern.exec(content)) !== null) {
        const name = match[1];
        const jsonStr = match[2].trim();
        let input = {};
        try {
            input = jsonStr ? JSON.parse(jsonStr) : {};
        }
        catch {
            input = { _error: 'Malformed JSON', _raw: jsonStr.slice(0, 200) };
        }
        results.push({ id: generateToolCallId(name), name, input });
    }
    // Pattern 1b: self-closing <tool-call name="ToolName" />
    const selfClosingPattern = /<tool-call\s+name="([^"]+)"\s*\/>/gi;
    while ((match = selfClosingPattern.exec(content)) !== null) {
        results.push({
            id: generateToolCallId(match[1]),
            name: match[1],
            input: {},
        });
    }
    // Pattern 2: JSON block with tool_calls array (Claude/OpenAI style in text)
    if (results.length === 0) {
        const jsonBlock = content.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);
        if (jsonBlock) {
            try {
                const parsed = JSON.parse(jsonBlock[0]);
                if (Array.isArray(parsed.tool_calls)) {
                    for (const tc of parsed.tool_calls) {
                        const name = tc.function?.name || tc.name;
                        const rawInput = tc.function?.arguments
                            ? (typeof tc.function.arguments === 'string'
                                ? JSON.parse(tc.function.arguments)
                                : tc.function.arguments)
                            : (tc.input || {});
                        if (name) {
                            results.push({ id: tc.id || generateToolCallId(name), name, input: rawInput || {} });
                        }
                    }
                }
            }
            catch { /* skip */ }
        }
    }
    // Filter
    if (availableTools && availableTools.size > 0) {
        return results.filter((tc) => availableTools.has(tc.name));
    }
    return filterValidTools(results);
}
// ── Tool Result Formatting ──
/**
 * Format a tool result as an Anthropic tool_result content block.
 * Used when sending tool results back to the LLM in the conversation.
 */
export function formatToolResultMessage(toolCallId, content, isError) {
    return {
        type: 'tool_result',
        tool_use_id: toolCallId,
        content,
        is_error: !!isError,
    };
}
/**
 * Format tool results as user message content (for providers that don't support
 * native tool_result blocks, or for backward compat).
 */
export function formatToolResultAsUserMessage(toolName, content) {
    return `[Tool: ${toolName}]\n${content}`;
}
// ── Helpers ──
let _idCounter = 0;
function generateToolCallId(name) {
    _idCounter++;
    return `toolu_${name}_${Date.now().toString(36)}_${_idCounter.toString(36)}`;
}
/**
 * Filter tool calls to only those that exist in the tool registry.
 */
function filterValidTools(calls) {
    return calls.filter((tc) => findTool(tc.name) !== undefined);
}
// ── Type Guards ──
/**
 * Check if response looks like an Anthropic API response with content blocks.
 */
export function isAnthropicResponse(raw) {
    if (!Array.isArray(raw))
        return false;
    if (raw.length === 0)
        return false;
    const first = raw[0];
    return first?.type === 'tool_use' || first?.type === 'text';
}
/**
 * Check if response is OpenAI-style tool_calls array.
 */
export function isOpenAIToolCalls(raw) {
    if (!Array.isArray(raw))
        return false;
    if (raw.length === 0)
        return false;
    const first = raw[0];
    return first?.type === 'function' && typeof first?.function === 'object';
}
//# sourceMappingURL=response-parser.js.map