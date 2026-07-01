/**
 * backup-core — Local backup & restore for agents/ and skills/
 *
 * Phase 7.3: Creates timestamped snapshots of agent/skill definitions.
 * Protects user customizations from being overwritten by updates.
 */
import { existsSync, mkdirSync, readdirSync, copyFileSync, writeFileSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { CODESQUAD_USER_ROOT, AICORE_AGENTS_DIR, AICORE_SKILLS_DIR } from './paths.js';
// ── Paths ──────────────────────────────────────────────
function getCodesquadHome() {
    // ~/.codesquad/
    return CODESQUAD_USER_ROOT;
}
function getBackupsDir() {
    return resolve(getCodesquadHome(), 'backups');
}
function getBackupManifestPath() {
    return resolve(getBackupsDir(), 'manifest.yaml');
}
// ── Helpers ────────────────────────────────────────────
function ensureDir(dirPath) {
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
    }
}
function copyDirRecursive(src, dest) {
    ensureDir(dest);
    const entries = readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = join(src, entry.name);
        const destPath = join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        }
        else {
            copyFileSync(srcPath, destPath);
        }
    }
}
function countFilesSync(dir) {
    if (!existsSync(dir))
        return 0;
    return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isFile()).length;
}
function countDirsSync(dir) {
    if (!existsSync(dir))
        return 0;
    return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).length;
}
// ── Manifest ───────────────────────────────────────────
function readBackupManifest() {
    const manifestPath = getBackupManifestPath();
    if (!existsSync(manifestPath))
        return [];
    try {
        const content = readFileSync(manifestPath, 'utf-8');
        const data = parseYaml(content);
        return data.backups ?? [];
    }
    catch (err) {
        console.error(`[backup] Failed to read backup manifest ${manifestPath}: ${err.message}`);
        return [];
    }
}
function writeBackupManifest(entries) {
    ensureDir(getBackupsDir());
    const data = { backups: entries };
    writeFileSync(getBackupManifestPath(), stringifyYaml(data), 'utf-8');
}
// ── Public API ─────────────────────────────────────────
/**
 * Create a backup of agents/ and skills/ directories.
 */
export function createBackup() {
    const agentsDir = AICORE_AGENTS_DIR;
    const skillsDir = AICORE_SKILLS_DIR;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupId = timestamp;
    const backupDir = resolve(getBackupsDir(), backupId);
    ensureDir(backupDir);
    // Copy agents/
    if (existsSync(agentsDir)) {
        copyDirRecursive(agentsDir, resolve(backupDir, 'agents'));
    }
    // Copy skills/
    if (existsSync(skillsDir)) {
        copyDirRecursive(skillsDir, resolve(backupDir, 'skills'));
    }
    const entry = {
        id: backupId,
        timestamp: new Date().toISOString(),
        path: backupDir,
        agentCount: countFilesSync(resolve(backupDir, 'agents')),
        skillCount: countDirsSync(resolve(backupDir, 'skills')),
    };
    // Update manifest
    const manifest = readBackupManifest();
    manifest.unshift(entry);
    writeBackupManifest(manifest);
    return entry;
}
/**
 * List all backups.
 */
export function listBackups() {
    const backups = readBackupManifest();
    return { backups };
}
/**
 * Restore a backup by ID.
 * Restores to ~/.codesquad/backups/restore-target/ instead of directly
 * overwriting .codesquad content.
 */
export function restoreBackup(backupId) {
    const manifest = readBackupManifest();
    const entry = manifest.find((b) => b.id === backupId);
    if (!entry)
        return null;
    if (!existsSync(entry.path)) {
        return null; // Backup data missing
    }
    const restoreRoot = resolve(getBackupsDir(), 'restore-target');
    const agentsDir = resolve(restoreRoot, 'agents');
    const skillsDir = resolve(restoreRoot, 'skills');
    const backupAgentsDir = resolve(entry.path, 'agents');
    const backupSkillsDir = resolve(entry.path, 'skills');
    if (existsSync(backupAgentsDir)) {
        copyDirRecursive(backupAgentsDir, agentsDir);
    }
    if (existsSync(backupSkillsDir)) {
        copyDirRecursive(backupSkillsDir, skillsDir);
    }
    return entry;
}
//# sourceMappingURL=backup-core.js.map