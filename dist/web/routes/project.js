/**
 * Project API — workspace info and config files.
 */
import { existsSync } from 'fs';
import { join } from 'path';
import { virtualExists, virtualReadDir } from '../../embedded/virtual-fs.js';
export async function handleProject(req, res, services) {
    const root = services.projectRoot;
    const configFiles = [
        'codesquad.config.yaml',
        'mcp.config.yaml',
        'models.config.yaml',
    ];
    const existing = configFiles.filter((f) => existsSync(join(root, f)));
    const agentsDir = join(root, '.codesquad', 'agents');
    const skillsDir = join(root, '.codesquad', 'skills');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        workspaceRoot: root,
        hasConfig: existing.length > 0,
        configFiles: existing,
        agentCount: virtualExists(agentsDir) ? countMdFiles(agentsDir) : 0,
        skillCount: virtualExists(skillsDir) ? countSubdirs(skillsDir) : 0,
    }));
}
function countMdFiles(dir) {
    try {
        return virtualReadDir(dir).filter((f) => f.endsWith('.md')).length;
    }
    catch {
        return 0;
    }
}
function countSubdirs(dir) {
    try {
        // VirtualFS entries are already directory names for skills
        return virtualReadDir(dir).length;
    }
    catch {
        return 0;
    }
}
//# sourceMappingURL=project.js.map