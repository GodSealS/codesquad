/**
 * Agent MD Parser
 *
 * Parses YAML frontmatter + body from agent markdown files.
 * Format: agents/<name>.md
 */
import type { AgentDef } from '../adapters/types.js';
/**
 * Parse a raw agent markdown string into an AgentDef.
 */
export declare function parseAgentMd(content: string, sourcePath?: string): AgentDef;
/**
 * Read and parse an agent markdown file from disk.
 */
export declare function readAgentMd(filePath: string): AgentDef;
//# sourceMappingURL=agent.schema.d.ts.map