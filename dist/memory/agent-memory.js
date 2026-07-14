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
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { projectDataDir } from '../chat/storage.js';
import { CODESQUAD_USER_ROOT } from '../core/paths.js';
// ── Paths ──
/**
 * Get the memory directory for an agent.
 * @param agentType - Agent type name (for assembly agents, use agent_parent)
 * @param scope - 'user' | 'project' | 'local'
 * @param instanceId - Optional instance ID for multi-role isolation
 */
export function getAgentMemoryDir(agentType, scope, instanceId) {
    const safeType = sanitizeAgentTypeForPath(agentType);
    let dir;
    if (scope === 'local') {
        // local: project-relative, not in version control
        dir = join(projectDataDir(), 'agent-memory-local', safeType);
    }
    else if (scope === 'project') {
        // project: project-relative, shared via version control
        dir = join(projectDataDir(), 'agent-memory', safeType);
    }
    else {
        // user scope: always stored in user home directory (cross-project)
        dir = join(CODESQUAD_USER_ROOT, 'agent-memory-user', safeType);
    }
    if (instanceId) {
        dir = join(dir, sanitizeAgentTypeForPath(instanceId));
    }
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    return dir;
}
/**
 * Load the agent's MEMORY.md content as a system prompt section.
 */
export function loadAgentMemoryPrompt(agentType, scope, instanceId) {
    const dir = getAgentMemoryDir(agentType, scope, instanceId);
    const memPath = join(dir, 'MEMORY.md');
    if (!existsSync(memPath))
        return '';
    try {
        const content = readFileSync(memPath, 'utf-8');
        if (!content.trim())
            return '';
        const scopeNote = scope === 'user'
            ? '(cross-project, keep learnings generic)'
            : scope === 'project'
                ? '(project-specific, shared via version control)'
                : '(local only, not in version control)';
        return `## Agent Memory (${scope}) ${scopeNote}\n\n${content}`;
    }
    catch {
        return '';
    }
}
/**
 * Check if a file path belongs to an agent memory directory.
 */
export function isAgentMemoryPath(absolutePath) {
    // Bug Fix #13: Match directory boundaries, not arbitrary substrings
    const sep = absolutePath.includes('\\') ? '\\' : '/';
    return absolutePath.includes(`${sep}agent-memory${sep}`)
        || absolutePath.includes(`${sep}agent-memory-local${sep}`)
        || absolutePath.endsWith(`${sep}agent-memory`)
        || absolutePath.endsWith(`${sep}agent-memory-local`);
}
/**
 * Sanitize agent type for filesystem path (remove colons and other illegal chars).
 */
export function sanitizeAgentTypeForPath(agentType) {
    return agentType.replace(/[<>:"/\\|?*]/g, '_');
}
//# sourceMappingURL=agent-memory.js.map