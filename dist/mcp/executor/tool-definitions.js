/**
 * Tool Definitions
 *
 * Unified tool definitions for LLM providers.
 * Maps CodeBuddy-style tool names to LLM tool schemas.
 *
 * Per D-07: MCP tool names = LLM tool names = CodeBuddy tool names.
 */
/** All tool definitions registered in the MCP Server */
export const TOOL_DEFINITIONS = [
    {
        name: 'Read',
        description: 'Reads a file from the local filesystem. You can access any file directly by using this tool.',
        input_schema: {
            type: 'object',
            properties: {
                filePath: {
                    type: 'string',
                    description: 'REQUIRED: The path of the file to read. Must point to a specific file, NOT a directory.',
                },
                offset: { type: 'number', description: 'The line number to start reading from.' },
                limit: { type: 'number', description: 'The number of lines to read.' },
            },
            required: ['filePath'],
        },
    },
    {
        name: 'Write',
        description: 'Writes a file to the local filesystem.',
        input_schema: {
            type: 'object',
            properties: {
                filePath: {
                    type: 'string',
                    description: 'REQUIRED: Target file absolute path. Parent directories will be created if needed.',
                },
                content: { type: 'string', description: 'REQUIRED: Content to write.' },
            },
            required: ['filePath', 'content'],
        },
    },
    {
        name: 'Edit',
        description: 'Performs exact string replacements in an existing file.',
        input_schema: {
            type: 'object',
            properties: {
                filePath: {
                    type: 'string',
                    description: 'REQUIRED: The path to the file to modify. Must be an absolute file path.',
                },
                old_str: { type: 'string', description: 'REQUIRED: The text to replace.' },
                new_str: { type: 'string', description: 'REQUIRED: The text to replace it with (must be different from old_str).' },
            },
            required: ['filePath', 'old_str', 'new_str'],
        },
    },
    {
        name: 'Glob',
        description: 'Find files matching a glob pattern.',
        input_schema: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'REQUIRED: File pattern (e.g., "*.js"). Supports wildcards.' },
                path: { type: 'string', description: 'Directory to search in. Defaults to workspace root.' },
            },
            required: ['pattern'],
        },
    },
    {
        name: 'Grep',
        description: 'Search file contents using regex patterns.',
        input_schema: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'REQUIRED: The regex pattern to search for.' },
                path: { type: 'string', description: 'File or directory to search. Defaults to workspace root.' },
                glob: { type: 'string', description: 'Glob pattern to filter files.' },
            },
            required: ['pattern'],
        },
    },
    {
        name: 'WebSearch',
        description: 'Search the web for information.',
        input_schema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'REQUIRED: Search query string.' },
            },
            required: ['query'],
        },
    },
    {
        name: 'WebFetch',
        description: 'Fetch content from a URL and processes into text.',
        input_schema: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'REQUIRED: URL to fetch.' },
                fetchInfo: { type: 'string', description: 'What information to extract from the page.' },
            },
            required: ['url'],
        },
    },
    {
        name: 'Bash',
        description: 'Execute a shell command. DISABLED by default — requires explicit whitelist.',
        input_schema: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'REQUIRED: The shell command to execute.' },
            },
            required: ['command'],
        },
    },
];
/** Get tool definitions filtered by allowed tool names */
export function getToolDefs(allowedTools) {
    return TOOL_DEFINITIONS.filter(t => allowedTools.includes(t.name));
}
/** Check if a tool requires explicit allow (e.g., Bash) */
export function requiresExplicitAllow(toolName) {
    return toolName === 'Bash';
}
//# sourceMappingURL=tool-definitions.js.map