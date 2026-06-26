/**
 * Team store — file-based persistence for team configurations.
 *
 * Storage: .codesquad/teams/{teamName}/config.json
 *
 * Feature 3 — P4 Team Collaboration
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'fs';
import { join } from 'path';
// ── Store root ──
let _storeRoot = '';
export function setTeamStoreRoot(projectRoot) {
    _storeRoot = join(projectRoot, '.codesquad', 'teams');
}
function getStoreRoot() {
    if (!_storeRoot) {
        _storeRoot = join(process.cwd(), '.codesquad', 'teams');
    }
    return _storeRoot;
}
function teamDir(name) {
    return join(getStoreRoot(), name);
}
function configPath(name) {
    return join(teamDir(name), 'config.json');
}
// ── CRUD ──
export function createTeam(name, leadAgentId, description = '', members = []) {
    const dir = teamDir(name);
    mkdirSync(dir, { recursive: true });
    const config = {
        name,
        description,
        leadAgentId,
        members: members.map((m) => ({ ...m, isActive: false })),
        createdAt: new Date().toISOString(),
    };
    writeFileSync(configPath(name), JSON.stringify(config, null, 2), 'utf-8');
    return config;
}
export function loadTeam(name) {
    const path = configPath(name);
    if (!existsSync(path))
        return null;
    try {
        return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch {
        return null;
    }
}
export function saveTeam(config) {
    const dir = teamDir(config.name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(configPath(config.name), JSON.stringify(config, null, 2), 'utf-8');
}
export function deleteTeam(name) {
    const dir = teamDir(name);
    if (!existsSync(dir))
        return false;
    try {
        rmSync(dir, { recursive: true, force: true });
        return true;
    }
    catch {
        return false;
    }
}
export function listTeams() {
    const root = getStoreRoot();
    if (!existsSync(root))
        return [];
    const teams = [];
    try {
        for (const entry of readdirSync(root)) {
            const cfg = loadTeam(entry);
            if (cfg)
                teams.push(cfg);
        }
    }
    catch { /* skip */ }
    return teams;
}
export function addTeamMember(teamName, member) {
    const config = loadTeam(teamName);
    if (!config)
        return false;
    if (config.members.some((m) => m.agentId === member.agentId)) {
        return false; // Already a member
    }
    config.members.push(member);
    saveTeam(config);
    return true;
}
export function removeTeamMember(teamName, agentId) {
    const config = loadTeam(teamName);
    if (!config)
        return false;
    const idx = config.members.findIndex((m) => m.agentId === agentId);
    if (idx < 0)
        return false;
    config.members.splice(idx, 1);
    saveTeam(config);
    return true;
}
export function setMemberActive(teamName, agentId, active) {
    const config = loadTeam(teamName);
    if (!config)
        return false;
    const member = config.members.find((m) => m.agentId === agentId);
    if (!member)
        return false;
    member.isActive = active;
    saveTeam(config);
    return true;
}
//# sourceMappingURL=store.js.map