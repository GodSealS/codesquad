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
export interface ParsedToolCall {
    id: string;
    name: string;
    input: Record<string, unknown>;
}
/**
 * Anthropic content block types (from streaming/non-streaming responses).
 */
export interface AnthropicContentBlock {
    type: 'text' | 'tool_use' | 'tool_result';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    tool_use_id?: string;
    content?: string | unknown[];
    is_error?: boolean;
}
/**
 * OpenAI tool call from choices[0].message.tool_calls
 */
export interface OpenAIToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}
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
export declare function parseToolCalls(rawContentBlocks: unknown, textContent: string, availableTools?: Set<string>): ParsedToolCall[];
/**
 * Extract tool_use blocks from Anthropic API response content array.
 * Mirrors Claude Code's msgToolUseBlocks filter.
 */
export declare function extractAnthropicToolCalls(contentBlocks: AnthropicContentBlock[]): ParsedToolCall[];
/**
 * Extract function calls from OpenAI API response.
 */
export declare function extractOpenAIToolCalls(toolCalls: OpenAIToolCall[]): ParsedToolCall[];
/**
 * Extract tool calls from XML-format text content.
 * Pattern: <tool-call name="ToolName">{"key":"value"}</tool-call>
 * Also supports self-closing: <tool-call name="ToolName" />
 *
 * This is the legacy extraction method, kept as fallback for:
 * - Ollama and other non-native providers
 * - LLMs that don't support native tool_use parameters
 */
export declare function extractXmlToolCalls(content: string, availableTools?: Set<string>): ParsedToolCall[];
/**
 * Format a tool result as an Anthropic tool_result content block.
 * Used when sending tool results back to the LLM in the conversation.
 */
export declare function formatToolResultMessage(toolCallId: string, content: string, isError?: boolean): AnthropicContentBlock;
/**
 * Format tool results as user message content (for providers that don't support
 * native tool_result blocks, or for backward compat).
 */
export declare function formatToolResultAsUserMessage(toolName: string, content: string): string;
/**
 * Check if response looks like an Anthropic API response with content blocks.
 */
export declare function isAnthropicResponse(raw: unknown): boolean;
/**
 * Check if response is OpenAI-style tool_calls array.
 */
export declare function isOpenAIToolCalls(raw: unknown): boolean;
//# sourceMappingURL=response-parser.d.ts.map