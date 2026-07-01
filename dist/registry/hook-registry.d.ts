/**
 * Hook registry — external registration into .codesquad/hooks/ (user-level).
 *
 * Pattern: graphify hook install/uninstall
 * - Copies hook script to .codesquad/hooks/
 * - Updates .codesquad/settings.json → hooks.SessionStart to register the command
 * - Unregister reverses both operations
 */
import type { RegistryEntry, RegisterResult } from './types.js';
export declare function scanHookDir(dir: string): Array<{
    name: string;
    filePath: string;
}>;
export declare function registerHookFile(aicoreRoot: string, sourcePath: string, sourceName: string): {
    name: string;
} | string;
export declare function registerHookDir(aicoreRoot: string, sourceDir: string, sourceName: string): RegisterResult;
export declare function listRegisteredHooks(aicoreRoot: string): RegistryEntry[];
export declare function unregisterHook(aicoreRoot: string, name: string): boolean;
//# sourceMappingURL=hook-registry.d.ts.map