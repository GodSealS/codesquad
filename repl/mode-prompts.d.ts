/**
 * Mode-specific system prompts injected into agent conversations.
 *
 * References Claude Code's approach of injecting mode instructions
 * via attachment/system messages.
 *
 * v4 (P1): Prompts accurately describe the Agent's real capability boundaries —
 * CodeSquad's callLLM returns plain text; Agents cannot actually write files
 * or execute commands. All operations are performed by the user in the terminal.
 */
import type { ChatMode } from './mode.js';
/**
 * Get the system prompt that describes the current mode's capabilities
 * and constraints. Injected as a system message before each agent call.
 */
export declare function getModeSystemPrompt(mode: ChatMode): string;
//# sourceMappingURL=mode-prompts.d.ts.map