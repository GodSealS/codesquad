/**
 * Agent registry — external registration into .codesquad/agents/ (user-level).
 */
import { existsSync, readdirSync, copyFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { readAgentMd } from '../schemas/agent.schema.js';
import { getUserCategoryDir } from './paths.js';
import { ensureManifest, addEntriesToManifest, removeEntriesFromManifest } from './manifest.js';
/** Scan agents in a directory (.md files, excluding manifest.yaml). */
export function scanAgentDir(dir) {
    if (!existsSync(dir))
        return [];
    try {
        return readdirSync(dir)
            .filter(f => f.endsWith('.md') && f !== 'manifest.yaml')
            .map(f => ({ name: f.replace(/\.md$/, ''), filePath: join(dir, f) }));
    }
    catch {
        return [];
    }
}
/** Parse an agent file. */
export function loadAgentFile(filePath) {
    try {
        return readAgentMd(filePath);
    }
    catch {
        return null;
    }
}
/** Register an external agent file to .codesquad/agents/. */
export function registerAgentFile(aicoreRoot, sourcePath, sourceName) {
    const agent = loadAgentFile(sourcePath);
    if (!agent)
        return `Failed to parse agent file: ${sourcePath}`;
    const destDir = getUserCategoryDir(aicoreRoot, 'agent');
    mkdirSync(destDir, { recursive: true });
    const destPath = join(destDir, `${agent.name}.md`);
    try {
        copyFileSync(sourcePath, destPath);
        addEntriesToManifest(aicoreRoot, [{
                name: agent.name, category: 'agent', source: 'external',
                externalSource: sourceName, registeredAt: new Date().toISOString(),
                sourcePath: destPath,
            }]);
        return { name: agent.name };
    }
    catch (err) {
        return `Failed to copy agent: ${err.message}`;
    }
}
/** Register an entire external agent directory to .codesquad/agents/. */
export function registerAgentDir(aicoreRoot, sourceDir, sourceName) {
    const result = { count: 0, updated: 0, skipped: 0, errors: [] };
    const destDir = getUserCategoryDir(aicoreRoot, 'agent');
    mkdirSync(destDir, { recursive: true });
    const agents = scanAgentDir(sourceDir);
    for (const { name, filePath } of agents) {
        try {
            const destPath = join(destDir, `${name}.md`);
            const existed = existsSync(destPath);
            copyFileSync(filePath, destPath);
            result.count++;
            if (existed)
                result.updated++;
            addEntriesToManifest(aicoreRoot, [{
                    name, category: 'agent', source: 'external',
                    externalSource: sourceName, registeredAt: new Date().toISOString(),
                    sourcePath: destPath,
                }]);
        }
        catch (err) {
            result.errors.push(`Agent ${name}: ${err.message}`);
        }
    }
    return result;
}
/** List registered agents. */
export function listRegisteredAgents(aicoreRoot) {
    return ensureManifest(aicoreRoot).entries.filter(e => e.category === 'agent');
}
/** Unregister an agent from .codesquad/agents/. */
export function unregisterAgent(aicoreRoot, name) {
    const dir = getUserCategoryDir(aicoreRoot, 'agent');
    const filePath = join(dir, `${name}.md`);
    if (!existsSync(filePath))
        return false;
    try {
        unlinkSync(filePath);
        removeEntriesFromManifest(aicoreRoot, 'agent', [name]);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=agent-registry.js.map