/**
 * CodeSquad MCP Server
 *
 * Stateless agent executor implementing the Model Context Protocol.
 * Supports stdio transport for IDE integration.
 *
 * Implements:
 *   - initialize          — capability negotiation
 *   - tools/list          — expose all available tools
 *   - tools/call          — execute tool (agent/skill invoke, discovery)
 *
 * The server is stateless: it holds no API keys, session state, or context.
 * All model configuration is provided by the caller in each request.
 */
/** Combined tool list (discovery + agent + skill tools) */
export declare const ALL_TOOLS: ({
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            query?: undefined;
            type?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            query: {
                type: string;
                description: string;
            };
            type: {
                type: string;
                enum: string[];
                default: string;
            };
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            filter: {
                type: string;
                description: string;
            };
            name?: undefined;
            input?: undefined;
            context?: undefined;
            history?: undefined;
            model_config?: undefined;
            arguments?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            name: {
                type: string;
                description?: undefined;
            };
            filter?: undefined;
            input?: undefined;
            context?: undefined;
            history?: undefined;
            model_config?: undefined;
            arguments?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            name: {
                type: string;
                description: string;
            };
            input: {
                type: string;
                description: string;
            };
            context: {
                type: string;
                properties: {
                    gdd: {
                        type: string;
                    };
                    code: {
                        type: string;
                    };
                    references: {
                        type: string;
                        items: {
                            type: string;
                        };
                    };
                    workspace_root: {
                        type: string;
                    };
                };
            };
            history: {
                type: string;
                items: {
                    type: string;
                    properties: {
                        role: {
                            type: string;
                            enum: string[];
                        };
                        content: {
                            type: string;
                        };
                    };
                };
            };
            model_config: {
                type: string;
                required: string[];
                properties: {
                    provider: {
                        type: string;
                        enum: string[];
                    };
                    api_key: {
                        type: string;
                    };
                    model: {
                        type: string;
                    };
                    base_url: {
                        type: string;
                    };
                    max_tokens: {
                        type: string;
                        default: number;
                    };
                    temperature: {
                        type: string;
                        default: number;
                    };
                };
            };
            filter?: undefined;
            arguments?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            name: {
                type: string;
                description: string;
            };
            arguments: {
                type: string;
                description: string;
            };
            context: {
                type: string;
                properties: {
                    gdd: {
                        type: string;
                    };
                    code: {
                        type: string;
                    };
                    workspace_root: {
                        type: string;
                    };
                    references?: undefined;
                };
            };
            model_config: {
                type: string;
                required: string[];
                properties: {
                    provider: {
                        type: string;
                        enum?: undefined;
                    };
                    api_key: {
                        type: string;
                    };
                    model: {
                        type: string;
                    };
                    base_url: {
                        type: string;
                    };
                    max_tokens: {
                        type: string;
                        default?: undefined;
                    };
                    temperature: {
                        type: string;
                        default?: undefined;
                    };
                };
            };
            filter?: undefined;
            input?: undefined;
            history?: undefined;
        };
        required: string[];
    };
})[];
export declare class CodeSquadMCPServer {
    private transport;
    private config;
    private projectRoot;
    private pidPath;
    private _disabled;
    constructor(projectRoot: string);
    /** Start the MCP server on stdio */
    start(): boolean;
    /** Stop the MCP server */
    stop(): boolean;
    /** P0 fix: Disable MCP — stops if running and prevents future starts */
    disable(): boolean;
    /** P0 fix: Re-enable MCP — allows start() to work again */
    enable(): boolean;
    /** Write PID file (D-16) */
    private writePidFile;
    /** Remove PID file on shutdown */
    private cleanupPidFile;
    /** Handle incoming MCP requests */
    private handleRequest;
    /** Handle initialize — capability negotiation */
    private handleInitialize;
    /** Handle tools/list — return all available tools */
    private handleToolsList;
    /** Handle tools/call — execute a tool */
    private handleToolsCall;
    /** Handle incoming notifications */
    private handleNotification;
    /** Reload configuration */
    reloadConfig(projectRoot: string): boolean;
}
//# sourceMappingURL=server.d.ts.map