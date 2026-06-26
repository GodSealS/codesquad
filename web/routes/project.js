/**
 * Project API — workspace info and config files.
 */
import { existsSync } from 'fs';
import { join } from 'path';
export async function handleProject(req, res, services) {
    const root = services.projectRoot;
    const configFiles = [
        'codesquad.config.yaml',
        'mcp.config.yaml',
        'models.config.yaml',
    ];
    const existing = configFiles.filter((f) => existsSync(join(root, f)));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        workspaceRoot: root,
        hasConfig: existing.length > 0,
        configFiles: existing,
        agentCount: existsSync(join(root, 'AICore', 'agents'))
            ? countMdFiles(join(root, 'AICore', 'agents'))
            : 0,
        skillCount: existsSync(join(root, 'AICore', 'skills'))
            ? countSubdirs(join(root, 'AICore', 'skills'))
            : 0,
    }));
}
function countMdFiles(dir) {
    try {
        const { readdirSync } = require('fs');
        return readdirSync(dir).filter((f) => f.endsWith('.md')).length;
    }
    catch {
        return 0;
    }
}
function countSubdirs(dir) {
    try {
        const { readdirSync } = require('fs');
        return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
    }
    catch {
        return 0;
    }
}
//# sourceMappingURL=project.js.map