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
// ── Engine command patterns ──
const ENGINE_PATTERNS = [
    // Unreal Engine
    { pattern: /\b(?:RunUAT|UBT|UnrealBuildTool|GenerateProjectFiles)\b/i, engine: 'unreal', label: 'UE' },
    { pattern: /\.uproject\b/i, engine: 'unreal', label: 'UE' },
    { pattern: /\bUE\d+\b/i, engine: 'unreal', label: 'UE' },
    // Unity
    { pattern: /\bUnity\.Editor\b/i, engine: 'unity', label: 'Unity' },
    { pattern: /\b(?:-quit|-batchmode|-buildTarget|UnityBuildPipeline)\b/i, engine: 'unity', label: 'Unity' },
    { pattern: /\b(?:Unity\.Cloud\.Build|unityhub)\b/i, engine: 'unity', label: 'Unity' },
    // Godot
    { pattern: /\b(?:godot|godot4)(?:\.exe)?(?:\s|"|$)/i, engine: 'godot', label: 'Godot' },
    { pattern: /\b(?:--headless|--export|--export-debug|--export-release)\b/i, engine: 'godot', label: 'Godot' },
    { pattern: /\bproject\.godot\b/i, engine: 'godot', label: 'Godot' },
    // Cocos
    { pattern: /\bcocos\b/i, engine: 'cocos', label: 'Cocos' },
    { pattern: /\bCocosCreator\b/i, engine: 'cocos', label: 'Cocos' },
];
// ── Read-only command patterns ──
const READ_COMMANDS = new Set([
    'cat', 'head', 'tail', 'less', 'more', 'wc', 'stat', 'file',
    'ls', 'tree', 'du', 'df',
    'find', 'grep', 'rg', 'ag', 'ack', 'locate', 'which', 'whereis',
    'echo', 'printf', 'printenv',
    'pwd', 'type',
]);
const GIT_READ_PREFIXES = [
    'git status', 'git diff', 'git log', 'git branch', 'git rev-parse',
    'git show', 'git stash list', 'git stash show', 'git describe',
    'git ls-files', 'git ls-tree',
];
// ── Build/test command patterns (safe subset) ──
const BUILD_TEST_PREFIXES = [
    'npm run build', 'npm run test', 'npm run lint',
    'npx vitest', 'npx tsc', 'npx eslint', 'npx prettier', 'npx jest',
    'dotnet build', 'dotnet test', 'dotnet publish',
    'msbuild', 'xcodebuild',
    'make', 'cmake --build', 'cargo build', 'cargo test',
    'go build', 'go test',
    'python -m pytest', 'pytest',
];
// ── Dangerous patterns ──
const DANGEROUS_PATTERNS = [
    /^rm\s+-rf/i,
    /^sudo\s/i,
    /^chmod\s+777/i,
    /^chown\s/i,
    /^dd\s/i,
    /^mkfs/i,
    /^shutdown/i,
    /^reboot/i,
    /^killall/i,
    /^pkill/i,
];
// ── Write commands ──
const WRITE_COMMANDS = new Set([
    'mv', 'cp', 'rm', 'mkdir', 'rmdir', 'chmod', 'chown',
    'touch', 'ln', 'dd',
    'install',
]);
/**
 * Classify a shell command into category + safety level.
 */
export function classifyCommand(command) {
    const trimmed = command.trim();
    const lower = trimmed.toLowerCase();
    // 1. Check dangerous patterns first
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(trimmed)) {
            return { category: 'write', safety: 'dangerous', isReadOnly: false, isDestructive: true };
        }
    }
    // 2. Check engine commands
    for (const ep of ENGINE_PATTERNS) {
        if (ep.pattern.test(trimmed)) {
            return {
                category: 'engine_build',
                safety: 'cautious',
                engine: ep.engine,
                isReadOnly: false,
                isDestructive: false,
            };
        }
    }
    // 3. Check git read commands
    for (const prefix of GIT_READ_PREFIXES) {
        if (lower.startsWith(prefix)) {
            return { category: 'git_read', safety: 'safe', isReadOnly: true, isDestructive: false };
        }
    }
    // 4. Check git write commands
    if (/^git\s+(commit|push|reset|rebase|merge|cherry-pick|add|checkout\s+-b)/i.test(trimmed)) {
        return { category: 'git_write', safety: 'cautious', isReadOnly: false, isDestructive: true };
    }
    // 5. Check build/test commands
    for (const prefix of BUILD_TEST_PREFIXES) {
        if (lower.startsWith(prefix)) {
            const isTest = lower.includes('test') || lower.includes('jest') || lower.includes('vitest') || lower.includes('pytest');
            return {
                category: isTest ? 'test' : 'build',
                safety: 'safe',
                isReadOnly: false,
                isDestructive: false,
            };
        }
    }
    // 6. Check read commands
    const firstWord = lower.split(/\s+/)[0] || '';
    if (READ_COMMANDS.has(firstWord)) {
        return { category: 'read', safety: 'safe', isReadOnly: true, isDestructive: false };
    }
    // 7. Check network commands
    if (/^curl\s/i.test(trimmed) || /^wget\s/i.test(trimmed)) {
        return { category: 'network', safety: 'cautious', isReadOnly: false, isDestructive: false };
    }
    // 8. Check package management
    if (/^npm\s+(install|i|add|update|uninstall)/i.test(trimmed) ||
        /^pip\s+(install|uninstall)/i.test(trimmed) ||
        /^dotnet\s+(restore|add\s+package)/i.test(trimmed)) {
        return { category: 'package', safety: 'cautious', isReadOnly: false, isDestructive: false };
    }
    // 9. Check write commands
    if (WRITE_COMMANDS.has(firstWord)) {
        return { category: 'write', safety: 'cautious', isReadOnly: false, isDestructive: true };
    }
    // 10. Default
    return { category: 'unknown', safety: 'cautious', isReadOnly: false, isDestructive: false };
}
/**
 * Get a human-readable safety hint for a classification.
 */
export function safetyHint(classification) {
    const hints = {
        safe: 'This command is read-only or non-destructive.',
        cautious: 'This command may modify files or make network requests.',
        dangerous: 'This command can destroy data or system state.',
    };
    const engineInfo = classification.engine
        ? ` | Engine: ${classification.engine}`
        : '';
    return `[${classification.category.toUpperCase()}] ${hints[classification.safety]}${engineInfo}`;
}
//# sourceMappingURL=command-classifier.js.map