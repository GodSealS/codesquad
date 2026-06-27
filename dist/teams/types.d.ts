/**
 * Team collaboration types — aligned with Claude Code's Team model.
 *
 * Feature 3 — P4 Team Collaboration
 */
import type { PermissionMode } from '../permissions/mode.js';
export interface TeamMember {
    agentId: string;
    name: string;
    agentType: string;
    isActive: boolean;
    permissionMode: PermissionMode;
}
export interface TeamConfig {
    name: string;
    description: string;
    leadAgentId: string;
    members: TeamMember[];
    createdAt: string;
}
export type TeamMessageType = 'message' | 'broadcast' | 'shutdown_request' | 'shutdown_response' | 'plan_approval';
export interface TeamMessage {
    from: string;
    to: string;
    content: string;
    summary: string;
    timestamp: string;
    type: TeamMessageType;
    read: boolean;
}
//# sourceMappingURL=types.d.ts.map