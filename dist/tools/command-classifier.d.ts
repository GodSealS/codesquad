/**
 * Command classifier — categorise shell commands for permission and UX decisions.
 *
 * Provides a simple AST-free command parser that classifies commands by:
 *   - category (read/write/build/test/git/etc.)
 *   - safety level (safe/cautious/dangerous)
 *   - engine relevance (UE/Unity/Godot/Cocos)
 *
 * References:
 *   Claude Code src/tools/BashTool/commandSemantics.ts
 *   Claude Code src/tools/BashTool/readOnlyValidation.ts
 *
 * Phase 2.0
 */
export type CommandCategory = 'read' | 'write' | 'build' | 'test' | 'git_read' | 'git_write' | 'package' | 'engine_build' | 'network' | 'utility' | 'unknown';
export type SafetyLevel = 'safe' | 'cautious' | 'dangerous';
export interface Classification {
    category: CommandCategory;
    safety: SafetyLevel;
    engine?: 'unreal' | 'unity' | 'godot' | 'cocos';
    isReadOnly: boolean;
    isDestructive: boolean;
}
/**
 * Classify a shell command into category + safety level.
 */
export declare function classifyCommand(command: string): Classification;
/**
 * Get a human-readable safety hint for a classification.
 */
export declare function safetyHint(classification: Classification): string;
//# sourceMappingURL=command-classifier.d.ts.map