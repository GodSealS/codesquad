/**
 * Team store — file-based persistence for team configurations.
 *
 * Storage: .codesquad/teams/{teamName}/config.json
 *
 * Feature 3 — P4 Team Collaboration
 */
import type { TeamConfig, TeamMember } from './types.js';
export declare function setTeamStoreRoot(projectRoot: string): void;
export declare function createTeam(name: string, leadAgentId: string, description?: string, members?: Omit<TeamMember, 'isActive'>[]): TeamConfig;
export declare function loadTeam(name: string): TeamConfig | null;
export declare function saveTeam(config: TeamConfig): void;
export declare function deleteTeam(name: string): boolean;
export declare function listTeams(): TeamConfig[];
export declare function addTeamMember(teamName: string, member: TeamMember): boolean;
export declare function removeTeamMember(teamName: string, agentId: string): boolean;
export declare function setMemberActive(teamName: string, agentId: string, active: boolean): boolean;
//# sourceMappingURL=store.d.ts.map