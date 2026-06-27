/**
 * AICore rules loader — path-matched rule injection.
 *
 * Scans AICore/rules/*.md, extracts path patterns from frontmatter,
 * and injects matching rules when tools interact with files.
 *
 * References:
 *   Claude Code src/utils/claudemd.ts — getConditionalRulesForCwdLevelDirectory()
 *
 * Phase 5.0
 */
export interface LoadedRule {
    name: string;
    paths: string[];
    content: string;
    layer?: 'user' | 'project';
}
/**
 * Load all rules from a single directory.
 */
export declare function loadAllRules(rulesDir: string): LoadedRule[];
/**
 * Load rules from two layers (Project .codesquad/ > User AICore/).
 * Override semantics: same-named rule from project wins.
 */
export declare function loadAllRulesLayered(aicoreRoot: string, cwd?: string): LoadedRule[];
/**
 * Find rules that match a given file path.
 * Compares each rule's path patterns against the file path.
 */
export declare function findMatchingRules(filePath: string, rulesDir: string): LoadedRule[];
/**
 * Format matching rules for injection into context.
 */
export declare function formatRulesForContext(rules: LoadedRule[]): string;
/**
 * Find rules matching a file path and return formatted context.
 */
export declare function getRulesContext(filePath: string, rulesDir: string): string;
/**
 * When writing/editing a file, check if rules apply.
 * Returns context text to inject, or empty string.
 */
export declare function getRulesForFileOperation(filePath: string, rulesDir: string): string;
/** Invalidate the rules cache. */
export declare function invalidateRulesCache(): void;
/**
 * Load rules that should be injected at session start.
 * Unlike path-matched rules (which fire on file access),
 * these are always visible to the agent.
 *
 * Rules matching:
 *   - Files starting with ALWAYS_ prefix → session-level
 *   - Files NOT starting with PATH_ and containing no path separators in name → session-level
 *
 * Loads from all three layers (Project > User > AICore), with later layers overriding.
 */
export declare function loadSessionRules(aicoreDir: string): string[];
//# sourceMappingURL=loader.d.ts.map