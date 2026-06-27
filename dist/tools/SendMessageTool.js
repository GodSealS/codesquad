/**
 * SendMessageTool — send messages between team members.
 *
 * Feature 3 — P4 Team Collaboration
 */
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { buildTool } from './types.js';
import { loadTeam } from '../teams/store.js';
import { sendMessage, broadcastMessage } from '../teams/mailbox.js';
const InputSchema = z.object({
    type: z.enum(['message', 'broadcast', 'shutdown_request', 'shutdown_response']),
    recipient: z.string().optional().describe('Agent name (for message/shutdown)'),
    content: z.string().describe('Message content'),
    summary: z.string().optional().describe('5-10 word summary'),
});
export const SendMessageTool = buildTool({
    name: 'SendMessage',
    description: 'Send messages between team members via file mailbox.',
    searchHint: 'send message team broadcast shutdown',
    inputSchema: InputSchema,
    prompt() {
        return `Sends messages between team members.

Parameters:
- type: "message" (direct), "broadcast" (all members), "shutdown_request" (ask agent to stop), "shutdown_response" (confirm/deny stop)
- recipient: Target agent name (for message/broadcast/shutdown types)
- content: Message content
- summary: Optional 5-10 word summary

Messages are delivered to the recipient's mailbox file.`;
    },
    descriptionFor(input) {
        if (input.type === 'broadcast')
            return `Broadcast to team: ${input.summary || input.content.slice(0, 40)}`;
        return `Send ${input.type} to ${input.recipient || 'unknown'}`;
    },
    isEnabled() { return true; },
    isReadOnly() { return false; },
    isConcurrencySafe() { return true; },
    isDestructive() { return false; },
    validateInput(input, _ctx) {
        if (!input.content.trim())
            return { valid: false, message: 'Message content required' };
        if (input.type !== 'broadcast' && !input.recipient) {
            return { valid: false, message: 'Recipient required for non-broadcast messages' };
        }
        return { valid: true };
    },
    checkPermissions() { return { behavior: 'allow' }; },
    async call(input, _context) {
        // Determine team from context (session metadata)
        // Mirrors Claude Code: uses getTeamName() from teammate.ts which derives from session state
        const teamName = _context.session.teamName || 'default';
        if (!teamName || teamName === 'default') {
            return {
                toolCallId: randomUUID(),
                output: null,
                content: `❌ No active team. Create one with TeamCreate first.`,
                isError: true,
            };
        }
        // Load team config (already validated above that teamName is valid)
        const team = loadTeam(teamName);
        if (input.type === 'broadcast') {
            const memberNames = team?.members.map((m) => m.name) || [];
            if (memberNames.length === 0) {
                return {
                    toolCallId: randomUUID(),
                    output: null,
                    content: `⚠️ Team has no members to broadcast to.`,
                };
            }
            broadcastMessage(teamName, _context.session.agent || 'system', input.content, input.summary, memberNames);
            return {
                toolCallId: randomUUID(),
                output: { type: 'broadcast', recipients: memberNames.length },
                content: `📢 Broadcast sent to ${memberNames.length} team members.`,
            };
        }
        sendMessage(teamName, input.recipient, _context.session.agent || 'system', input.content, input.type, input.summary);
        const typeLabel = input.type === 'shutdown_request' ? '🛑 Shutdown request' :
            input.type === 'shutdown_response' ? '✅ Shutdown response' : '✉️ Message';
        return {
            toolCallId: randomUUID(),
            output: { type: input.type, recipient: input.recipient },
            content: `${typeLabel} sent to ${input.recipient}.`,
        };
    },
    maxResultSizeChars: 1000,
});
//# sourceMappingURL=SendMessageTool.js.map