/**
 * lockfile — .codesquad.lock management
 *
 * Phase 7.4: Records generation metadata (version, timestamp, file hashes)
 * to enable diff-based incremental updates and protect user customizations.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
// ── Paths ──────────────────────────────────────────────
const PROJECT_ROOT = process.cwd();
function getLockPath(targetPath) {
    return resolve(PROJECT_ROOT, targetPath, '.codesquad.lock');
}
// ── Hash ───────────────────────────────────────────────
function sha256(content) {
    return createHash('sha256').update(content).digest('hex');
}
// ── Public API ─────────────────────────────────────────
/**
 * Read an existing lock file.
 */
export function readLock(targetPath = '.') {
    const lockPath = getLockPath(targetPath);
    if (!existsSync(lockPath))
        return null;
    try {
        const content = readFileSync(lockPath, 'utf-8');
        return parseYaml(content);
    }
    catch (err) {
        console.error(`[lockfile] Failed to read lock ${lockPath}: ${err.message}`);
        return null;
    }
}
/**
 * Create or update a lock file with current generation state.
 */
export function writeLock(targetPath, cliVersion, definitionsVersion, files) {
    const lockPath = getLockPath(targetPath);
    const fileEntries = {};
    for (const [filePath, content] of files) {
        fileEntries[filePath] = { hash: sha256(content) };
    }
    const lock = {
        version: 1,
        generated_at: new Date().toISOString(),
        cli_version: cliVersion,
        definitions_version: definitionsVersion,
        files: fileEntries,
    };
    writeFileSync(lockPath, stringifyYaml(lock), 'utf-8');
}
/**
 * Check if a file was modified by the user (hash differs from lock).
 * Returns 'unchanged' | 'modified' | 'new' | 'unknown'
 */
export function checkFileStatus(lock, filePath, currentContent) {
    if (!lock)
        return 'unknown';
    if (!lock.files[filePath])
        return 'new';
    const currentHash = sha256(currentContent);
    const lockedHash = lock.files[filePath].hash;
    return currentHash === lockedHash ? 'unchanged' : 'modified';
}
/**
 * Compute the hash for a file's content (useful when writing new lock entries).
 */
export function hashContent(content) {
    return sha256(content);
}
//# sourceMappingURL=lockfile.js.map