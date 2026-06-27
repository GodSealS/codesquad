/**
 * REPL command parser.
 *
 * Parses input lines into structured commands:
 *   @agent-name [input]   → AgentCommand
 *   /skill-name [args]    → SkillCommand
 *   /cmd                  → BuiltinCommand
 *   plain text            → TextInput
 * Phase 1.1 — Step 1.1.2.
 */
// ── Builtin command names ──
const BUILTIN_COMMANDS = new Set([
    'agents', 'skills', 'help', 'quit', 'exit',
    'sessions', 'resume', 'new',
    'ctx', 'context',
    'model', 'provider',
    'export',
    'usage',
    'rename',
    'agent', // /agent <name> → view agent description
    'skill', // /skill <name> → view skill description
    'mode', // /mode [ask|craft|plan] → switch or query mode
    'memory-limit', // /memory-limit [n] → get/set cross-chat memory limit (2-15)
    'tools', // /tools → list available tools
    'compact', // /compact → manually compact conversation context
]);
// ── Parse function ──
/**
 * Parse a raw input line into a structured command.
 *
 * Rules (in priority order):
 *   1. Empty / whitespace-only → EmptyInput
 *   2. "@" prefix → AgentCommand
 *   3. "/" prefix + known builtin → BuiltinCommand
 *   4. "/" prefix + unknown → SkillCommand (pass-through)
 *   5. Everything else → TextInput
 */
export function parseInput(raw) {
    const trimmed = raw.trim();
    // Empty line
    if (trimmed.length === 0) {
        return { type: 'empty' };
    }
    // @agent-name [input]
    if (trimmed.startsWith('@')) {
        const agentMatch = trimmed.match(/^@(\S+)\s*(.*)/s);
        if (!agentMatch || !agentMatch[1]) {
            return { type: 'text', content: trimmed }; // bare "@", treat as text
        }
        const name = agentMatch[1];
        const input = (agentMatch[2] ?? '').trim();
        return { type: 'agent', name, input };
    }
    // /command [args]
    if (trimmed.startsWith('/')) {
        const cmdMatch = trimmed.match(/^\/(\S+)\s*(.*)/s);
        if (!cmdMatch || !cmdMatch[1]) {
            return { type: 'text', content: trimmed }; // bare "/", treat as text
        }
        const name = cmdMatch[1].toLowerCase();
        const args = (cmdMatch[2] ?? '').trim();
        if (BUILTIN_COMMANDS.has(name)) {
            return { type: 'builtin', name, args };
        }
        // Unknown / prefix → treat as skill invocation
        return { type: 'skill', name, args };
    }
    // Plain text
    return { type: 'text', content: trimmed };
}
//# sourceMappingURL=parser.js.map