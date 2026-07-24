/**
 * REPL command parser.
 *
 * Parses input lines into structured commands:
 *   @agent-name [input]   → AgentCommand
 *   /skill-name [args]    → SkillCommand
 *   /cmd                  → BuiltinCommand or CommandCommand
 *   plain text            → TextInput
 * Phase 1.1 — Step 1.1.3.
 */
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
// ── Builtin command names ──
const BUILTIN_COMMANDS = new Set([
    'agents', 'skills', 'help', 'quit', 'exit',
    'sessions', 'resume', 'new',
    'ctx', 'context',
    'model', 'provider',
    'export',
    'usage',
    'rename',
    'agent',
    'skill',
    'mode',
    'memory-limit',
    'tools',
    'compact',
    'delete', 'del',
    'stream',
    'tasks',
    'team',
    'reset',
]);
// ── Command file registry ──
/** Map of command name → absolute path to .codesquad/commands/<name>.md */
const COMMAND_REGISTRY = new Map();
/**
 * Scan `.codesquad/commands/` for `.md` command files on startup.
 * Each file name (without .md) becomes a registered command.
 */
export function scanCommands(codesquadDir) {
    const dir = join(codesquadDir, 'commands');
    COMMAND_REGISTRY.clear(); // Bug 6: clear stale entries before re-scan
    if (!existsSync(dir))
        return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.md'))
            continue;
        const name = entry.name.replace(/\.md$/, '');
        COMMAND_REGISTRY.set(name, join(dir, entry.name));
    }
}
/** Get all registered command names. */
export function getCommandNames() {
    return [...COMMAND_REGISTRY.keys()];
}
/** Get command file path by name. */
export function getCommandPath(name) {
    return COMMAND_REGISTRY.get(name);
}
// ── Parse function ──
/**
 * Parse a raw input line into a structured command.
 *
 * Rules (in priority order):
 *   1. Empty / whitespace-only → EmptyInput
 *   2. "@" prefix → AgentCommand
 *   3. "/" prefix + known builtin → BuiltinCommand
 *   4. "/" prefix + registered command → CommandCommand
 *   5. "/" prefix + unknown → SkillCommand (pass-through)
 *   6. Everything else → TextInput
 */
export function parseInput(raw) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return { type: 'empty' };
    }
    if (trimmed.startsWith('@')) {
        const agentMatch = trimmed.match(/^@(\S+)\s*(.*)/s);
        if (!agentMatch || !agentMatch[1]) {
            return { type: 'text', content: trimmed };
        }
        const name = agentMatch[1];
        const input = (agentMatch[2] ?? '').trim();
        return { type: 'agent', name, input };
    }
    if (trimmed.startsWith('/')) {
        const cmdMatch = trimmed.match(/^\/(\S+)\s*(.*)/s);
        if (!cmdMatch || !cmdMatch[1]) {
            return { type: 'text', content: trimmed };
        }
        const name = cmdMatch[1].toLowerCase();
        const args = (cmdMatch[2] ?? '').trim();
        if (BUILTIN_COMMANDS.has(name)) {
            return { type: 'builtin', name, args };
        }
        // Check command file registry
        const cmdPath = COMMAND_REGISTRY.get(name);
        if (cmdPath) {
            return { type: 'command', name, args, path: cmdPath };
        }
        // Unknown / prefix → treat as skill invocation
        return { type: 'skill', name, args };
    }
    return { type: 'text', content: trimmed };
}
//# sourceMappingURL=parser.js.map