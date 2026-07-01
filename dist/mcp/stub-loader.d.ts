/**
 * .codesquad Stub Loader
 *
 * Parses .codesquad agent/skill stub files (schema: aicore-mcp-stub/v2).
 * Provides discovery, filtering, and schema retrieval for MCP tools.
 *
 * Stubs are lightweight interface declarations that map to MCP tool calls.
 * They do NOT contain full agent/skill prompts (those are in .codesquad/).
 */
/** Raw frontmatter and body from a markdown file */
interface ParsedMarkdown {
    frontmatter: Record<string, unknown>;
    body: string;
}
/** MCP route embedded in a stub */
export interface McpRoute {
    server: string;
    tool: string;
    params: Record<string, string>;
}
/** Context requirements declared by a stub */
export interface RequiresContext {
    gdd?: {
        type: string;
        required: boolean;
        description: string;
    };
    code?: {
        type: string;
        required: boolean;
        description: string;
    };
    references?: {
        type: string;
        required: boolean;
        description: string;
    };
}
/** Input parameter schema */
export interface StubParam {
    type: string;
    required: boolean;
    description: string;
    items?: string;
}
/** Output schema declaration */
export interface StubOutput {
    [key: string]: {
        type: string;
        description: string;
    };
}
/** A loaded MCP stub (agent or skill) */
export interface StubEntry {
    /** File path (relative to .codesquad root) */
    path: string;
    /** stub schema version */
    schema: string;
    /** 'agent' | 'skill' */
    type: 'agent' | 'skill';
    /** Stub name (matches agent/skill identifier) */
    name: string;
    /** Human-readable description */
    description: string;
    /** MCP route: server + tool + params */
    mcp: McpRoute;
    /** Context requirements */
    requiresContext?: RequiresContext;
    /** Input parameters */
    input?: Record<string, StubParam>;
    /** Output schema */
    output?: StubOutput;
    /** Required caller configuration */
    requiredConfig?: string[];
    /** Supported modes */
    mode?: string[];
    /** Tags for filtering */
    tags?: string[];
    /** Whether user-invocable (skills only) */
    userInvocable?: boolean;
}
/** Parse YAML frontmatter and body from a markdown file */
export declare function parseMarkdownFrontmatter(content: string): ParsedMarkdown | null;
/** Read and parse a single stub file */
export declare function parseStubFile(filePath: string): StubEntry | null;
/** Find all agent stub files in .codesquad/agents/ (with fallback to .aicore-mcp-stubs/) */
export declare function loadAgentStubs(): StubEntry[];
/** Find all skill stub files in .codesquad/skills/ (with fallback to .aicore-mcp-stubs/) */
export declare function loadSkillStubs(): StubEntry[];
/** Load all stubs (agents + skills) */
export declare function loadAllStubs(): {
    agents: StubEntry[];
    skills: StubEntry[];
};
/** Find a specific agent stub by name (checks .codesquad/ first, then .aicore-mcp-stubs/) */
export declare function findAgentStub(name: string): StubEntry | undefined;
/** Find a specific skill stub by name (checks .codesquad/ first, then .aicore-mcp-stubs/) */
export declare function findSkillStub(name: string): StubEntry | undefined;
/** Filter stubs by tag */
export declare function filterByTag(stubs: StubEntry[], tag: string): StubEntry[];
/** Search stubs by keyword in name and description */
export declare function searchStubs(stubs: StubEntry[], query: string): StubEntry[];
export {};
//# sourceMappingURL=stub-loader.d.ts.map