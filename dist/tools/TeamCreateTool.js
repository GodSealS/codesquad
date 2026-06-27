/**
 * TeamCreateTool — create a new agent team.
 *
 * Feature 3 — P4 Team Collaboration
 */
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { buildTool } from './types.js';
import { createTeam } from '../teams/store.js';
const InputSchema = z.object({
    team_name: z.string().describe('Unique team name (lowercase with hyphens)'),
    description: z.string().optional(),
    members: z.array(z.object({
        agent: z.string(),
        name: z.string(),
    })).optional().default([]).describe('Initial team members'),
});
export const TeamCreateTool = buildTool({
    name: 'TeamCreate',
    description: 'Create a new agent team for collaborative work.',
    searchHint: 'team create collaboration agents',
    inputSchema: InputSchema,
    prompt() {
        return `Creates a new team of agents that can collaborate via message passing.

Parameters:
- team_name: Unique team name (lowercase, use hyphens, e.g. "feature-alpha")
- description: Optional team purpose
- members: Array of {agent, name} for initial team members

Returns team config. Use SendMessage to communicate with team members.`;
    },
    descriptionFor(input) {
        return `Create team "${input.team_name}" with ${input.members.length} members`;
    },
    isEnabled() { return true; },
    isReadOnly() { return false; },
    isConcurrencySafe() { return true; },
    isDestructive() { return false; },
    validateInput(input, _ctx) {
        if (!input.team_name.trim())
            return { valid: false, message: 'Team name required' };
        if (!/^[a-z][a-z0-9-]*$/.test(input.team_name)) {
            return { valid: false, message: 'Team name must be lowercase with hyphens only' };
        }
        return { valid: true };
    },
    checkPermissions() { return { behavior: 'allow' }; },
    async call(input, context) {
        const config = createTeam(input.team_name, context.session.agent || 'main', input.description, input.members.map((m) => ({
            agentId: m.agent,
            name: m.name,
            agentType: m.agent,
            permissionMode: context.permissionMode,
        })));
        return {
            toolCallId: randomUUID(),
            output: config,
            content: `✅ Team "${config.name}" created.\n` +
                `   Lead: ${config.leadAgentId}\n` +
                `   Members: ${config.members.length}\n` +
                `   Use SendMessage to communicate with team members.`,
        };
    },
    maxResultSizeChars: 1000,
});
//# sourceMappingURL=TeamCreateTool.js.map