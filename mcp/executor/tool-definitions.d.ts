/**
 * Tool Definitions
 *
 * Unified tool definitions for LLM providers.
 * Maps CodeBuddy-style tool names to LLM tool schemas.
 *
 * Per D-07: MCP tool names = LLM tool names = CodeBuddy tool names.
 */
import type { LLMToolDef } from '../llm/types.js';
/** All tool definitions registered in the MCP Server */
export declare const TOOL_DEFINITIONS: LLMToolDef[];
/** Get tool definitions filtered by allowed tool names */
export declare function getToolDefs(allowedTools: string[]): LLMToolDef[];
/** Check if a tool requires explicit allow (e.g., Bash) */
export declare function requiresExplicitAllow(toolName: string): boolean;
//# sourceMappingURL=tool-definitions.d.ts.map