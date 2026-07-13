/**
 * Agent Memory — independent memory scopes for agents.
 *
 * Supports 3 scopes (user/project/local) with optional instanceId
 * for multi-role isolation (CodeSquad extension beyond Claude Code).
 *
 * Path rules:
 *   No instanceId:  .codesquad/agent-memory[-local]/<agentType>/MEMORY.md
 *   With instanceId: .codesquad/agent-memory[-local]/<agentType>/<instanceId>/MEMORY.md
 *
 * References:
 *   Claude Code src/tools/AgentTool/agentMemory.ts
 *   Idea/tutrue/memory-system-design.md §2.3.2
 */
export type AgentMemoryScope = 'user' | 'project' | 'local';
/**
 * Get the memory directory for an agent.
 * @param agentType - Agent type name (for assembly agents, use agent_parent)
 * @param scope - 'user' | 'project' | 'local'
 * @param instanceId - Optional instance ID for multi-role isolation
 */
export declare function getAgentMemoryDir(agentType: string, scope: AgentMemoryScope, instanceId?: string): string;
/**
 * Load the agent's MEMORY.md content as a system prompt section.
 */
export declare function loadAgentMemoryPrompt(agentType: string, scope: AgentMemoryScope, instanceId?: string): string;
/**
 * Check if a file path belongs to an agent memory directory.
 */
export declare function isAgentMemoryPath(absolutePath: string): boolean;
/**
 * Sanitize agent type for filesystem path (remove colons and other illegal chars).
 */
export declare function sanitizeAgentTypeForPath(agentType: string): string;
//# sourceMappingURL=agent-memory.d.ts.map