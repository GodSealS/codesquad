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
export type ParsedCommand = AgentCommand | SkillCommand | BuiltinCommand | TextInput | EmptyInput;
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
export declare function parseInput(raw: string): ParsedCommand;
//# sourceMappingURL=parser.d.ts.map