/**
 * File System Utilities
 *
 * Shared helpers for safe file/directory operations used across core and generators.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, } from 'fs';
import { join, dirname } from 'path';
/** Ensure a directory exists (recursive mkdir) */
export function ensureDir(dir) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}
/** Ensure the parent directory of a file path exists */
export function ensureParentDir(filePath) {
    ensureDir(dirname(filePath));
}
/** Safely read a file; returns null if it doesn't exist */
export function readFileSafe(filePath) {
    try {
        if (!existsSync(filePath))
            return null;
        return readFileSync(filePath, 'utf-8');
    }
    catch {
        return null;
    }
}
/** Write a file, creating parent directories automatically */
export function writeFileSafe(filePath, content) {
    ensureParentDir(filePath);
    writeFileSync(filePath, content, 'utf-8');
}
/** Recursively list all files with an optional extension filter */
export function listFilesRecursive(dir, ext) {
    const results = [];
    if (!existsSync(dir))
        return results;
    const entries = readdirSync(dir);
    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            results.push(...listFilesRecursive(fullPath, ext));
        }
        else if (!ext || entry.endsWith(ext)) {
            results.push(fullPath);
        }
    }
    return results;
}
/** Safely remove a file or directory (recursive) */
export function removeSafe(targetPath) {
    try {
        if (!existsSync(targetPath))
            return;
        rmSync(targetPath, { recursive: true, force: true });
    }
    catch {
        // Best-effort removal
    }
}
/** Count files matching an extension in a directory (non-recursive) */
export function countFiles(dir, ext) {
    try {
        if (!existsSync(dir))
            return 0;
        return readdirSync(dir).filter((f) => f.endsWith(ext)).length;
    }
    catch {
        return 0;
    }
}
//# sourceMappingURL=fs.js.map