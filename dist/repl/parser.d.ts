/**
 * REPL command parser.
 *
 * Parses input lines into structured commands:
 *   @agent-name [input]   → AgentCommand
 *   /skill-name [args]    → SkillCommand
 *   /cmd                  → BuiltinCommand or CommandCommand
 *   plain text            → TextInput
 * Phase 1.1 — Step 1.1.2.
 */
export interface AgentCommand {
    type: 'agent';
    name: string;
    input: string;
}
export interface SkillCommand {
    type: 'skill';
    name: string;
    args: string;
}
export interface CommandCommand {
    type: 'command';
    name: string;
    args: string;
    path: string;
}
export interface BuiltinCommand {
    type: 'builtin';
    name: string;
    args: string;
}
export interface TextInput {
    type: 'text';
    content: string;
}
export interface EmptyInput {
    type: 'empty';
}
export type ParsedCommand = AgentCommand | SkillCommand | CommandCommand | BuiltinCommand | TextInput | EmptyInput;
/**
 * Scan `.codesquad/commands/` for `.md` command files on startup.
 * Each file name (without .md) becomes a registered command.
 */
export declare function scanCommands(codesquadDir: string): void;
/** Get all registered command names. */
export declare function getCommandNames(): string[];
/** Get command file path by name. */
export declare function getCommandPath(name: string): string | undefined;
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
export declare function parseInput(raw: string): ParsedCommand;
//# sourceMappingURL=parser.d.ts.map