/**
 * Team mailbox — file-based message passing between team members.
 *
 * Storage: .codesquad/teams/{teamName}/inboxes/{agentName}.json
 * Uses lockfile pattern (writeFileSync + retry) to prevent concurrent write conflicts.
 *
 * Feature 3 — P4 Team Collaboration
 */
import type { TeamMessage, TeamMessageType } from './types.js';
export declare function sendMessage(teamName: string, to: string, from: string, content: string, type?: TeamMessageType, summary?: string): void;
export declare function broadcastMessage(teamName: string, from: string, content: string, summary?: string, memberNames?: string[]): void;
export declare function readMessages(teamName: string, agentName: string): TeamMessage[];
export declare function getUnreadMessages(teamName: string, agentName: string): TeamMessage[];
export declare function markRead(teamName: string, agentName: string, timestamp: string): void;
export declare function clearInbox(teamName: string, agentName: string): void;
export declare function deleteInbox(teamName: string): void;
//# sourceMappingURL=mailbox.d.ts.map