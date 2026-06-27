/**
 * TeamDeleteTool — delete a team and cleanup all resources.
 *
 * Feature 3 — P4 Team Collaboration
 */
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { buildTool } from './types.js';
import { deleteTeam, loadTeam } from '../teams/store.js';
import { deleteInbox } from '../teams/mailbox.js';
const InputSchema = z.object({
    team_name: z.string().describe('Team name to delete'),
});
export const TeamDeleteTool = buildTool({
    name: 'TeamDelete',
    description: 'Delete a team and all its inboxes.',
    searchHint: 'team delete remove cleanup',
    inputSchema: InputSchema,
    prompt() {
        return `Deletes a team and all associated resources (config, inboxes).

Parameters:
- team_name: Name of the team to delete.

⚠️ This is destructive — all team messages will be lost.`;
    },
    descriptionFor(input) {
        return `Delete team "${input.team_name}"`;
    },
    isEnabled() { return true; },
    isReadOnly() { return false; },
    isConcurrencySafe() { return false; },
    isDestructive() { return true; },
    validateInput(input, _ctx) {
        if (!input.team_name.trim())
            return { valid: false, message: 'Team name required' };
        return { valid: true };
    },
    checkPermissions() { return { behavior: 'allow' }; },
    async call(input, _context) {
        const config = loadTeam(input.team_name);
        if (!config) {
            return {
                toolCallId: randomUUID(),
                output: false,
                content: `❌ Team not found: "${input.team_name}"`,
                isError: true,
            };
        }
        // Check: all members must be inactive
        const activeMembers = config.members.filter((m) => m.isActive);
        if (activeMembers.length > 0) {
            return {
                toolCallId: randomUUID(),
                output: false,
                content: `❌ Cannot delete — ${activeMembers.length} members still active:\n` +
                    activeMembers.map((m) => `   - ${m.name} (${m.agentId})`).join('\n'),
                isError: true,
            };
        }
        deleteInbox(input.team_name);
        const success = deleteTeam(input.team_name);
        return {
            toolCallId: randomUUID(),
            output: success,
            content: success
                ? `✅ Team "${input.team_name}" deleted.`
                : `❌ Failed to delete team "${input.team_name}".`,
        };
    },
    maxResultSizeChars: 1000,
});
//# sourceMappingURL=TeamDeleteTool.js.map