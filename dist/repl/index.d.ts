/**
 * CodeSquad Terminal REPL — Main entry point.
 *
 * Launches an interactive readline-based REPL that supports:
 *   @agent-name → invoke an agent for conversation via LLM
 *   /skill-name → invoke a skill via MCP
 *   /cmd        → builtin command handler
 *
 * Pipeline: User input → readline → parser → LLM/MCP → display → session save
 */
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { MCPBridge } from '../tools/MCPBridge.js';
/**
 * Load MCP server configurations and register their tools.
 * Reads from .codesquad/settings.json mcpServers block (if present),
 * or from Config/mcp.config.yaml fallback.
 *
 * Mirrors Claude Code's MCP client initialization in bootstrap.
 */
export declare function loadAndRegisterMCPTools(aicoreDir: string, toolRegistry?: ToolRegistry, mcpBridge?: MCPBridge): Promise<void>;
export declare function startRepl(): Promise<void>;
//# sourceMappingURL=index.d.ts.map