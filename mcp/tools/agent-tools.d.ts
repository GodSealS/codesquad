/**
 * MCP Server — Agent Tools
 *
 * Implements:
 *   - agent.list    — list all agents with metadata
 *   - agent.schema  — get full interface contract for a specific agent
 *   - agent.invoke  — execute an agent (Phase 4, stub for now)
 */
import type { MCPCallToolResult } from '../transport/types.js';
/** Route an agent tool call */
export declare function handleAgentTool(toolName: string, params?: Record<string, unknown>): Promise<MCPCallToolResult | null>;
/** Agent invoke arguments type (re-export for use) */
import type { AgentInvokeArgs } from '../executor/agent-runner.js';
export type { AgentInvokeArgs };
//# sourceMappingURL=agent-tools.d.ts.map