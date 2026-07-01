/**
 * Rule registry — external registration into .codesquad/rules/ (user-level).
 */
import type { RegistryEntry, RegisterResult } from './types.js';
export declare function scanRuleDir(dir: string): Array<{
    name: string;
    filePath: string;
}>;
export declare function registerRuleFile(aicoreRoot: string, sourcePath: string, sourceName: string): {
    name: string;
} | string;
export declare function registerRuleDir(aicoreRoot: string, sourceDir: string, sourceName: string): RegisterResult;
export declare function listRegisteredRules(aicoreRoot: string): RegistryEntry[];
export declare function unregisterRule(aicoreRoot: string, name: string): boolean;
//# sourceMappingURL=rule-registry.d.ts.map