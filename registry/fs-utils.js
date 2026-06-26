/**
 * File-system utilities for the registry.
 */
import { readdirSync, mkdirSync, copyFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';
/**
 * Recursively copy a directory from src to dest.
 * Skips existing files unless force is true.
 * @returns Number of files copied.
 */
export function walkCopyDir(src, dest, force) {
    let count = 0;
    mkdirSync(dest, { recursive: true });
    const entries = readdirSync(src);
    for (const entry of entries) {
        const srcPath = join(src, entry);
        const destPath = join(dest, entry);
        const stat = statSync(srcPath);
        if (stat.isDirectory()) {
            count += walkCopyDir(srcPath, destPath, force);
        }
        else {
            if (force || !existsSync(destPath)) {
                copyFileSync(srcPath, destPath);
                count++;
            }
        }
    }
    return count;
}
//# sourceMappingURL=fs-utils.js.map