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
import { StdioTransport } from './transport/stdio.js';
import { DISCOVERY_TOOLS, handleDiscoveryTool } from './tools/discovery-tools.js';
import { handleAgentTool } from './tools/agent-tools.js';
import { handleSkillTool } from './tools/skill-tools.js';
import { loadMcpConfig } from './config.js';
/** Combined tool list (discovery + agent + skill tools) */
export const ALL_TOOLS = [
    ...DISCOVERY_TOOLS,
    {
        name: 'agent.list',
        description: 'List all available agents with name, description, and interface schema',
        inputSchema: {
            type: 'object',
            properties: {
                filter: { type: 'string', description: 'Optional: filter by tag or category' },
            },
        },
    },
    {
        name: 'agent.schema',
        description: "Get the complete input/output interface contract for a specific agent",
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
            },
            required: ['name'],
        },
    },
    {
        name: 'agent.invoke',
        description: 'Invoke a CodeSquad agent by name. The agent will execute autonomously and return results.',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: "Agent name, e.g. 'game-designer'" },
                input: { type: 'object', description: 'Agent-specific input parameters' },
                context: {
                    type: 'object',
                    properties: {
                        gdd: { type: 'string' },
                        code: { type: 'string' },
                        references: { type: 'array', items: { type: 'string' } },
                        workspace_root: { type: 'string' },
                    },
                },
                history: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            role: { type: 'string', enum: ['user', 'assistant', 'tool'] },
                            content: { type: 'string' },
                        },
                    },
                },
                model_config: {
                    type: 'object',
                    required: ['provider', 'api_key', 'model'],
                    properties: {
                        provider: { type: 'string', enum: ['anthropic', 'openai', 'openai-compatible', 'deepseek', 'kimi'] },
                        api_key: { type: 'string' },
                        model: { type: 'string' },
                        base_url: { type: 'string' },
                        max_tokens: { type: 'number', default: 4096 },
                        temperature: { type: 'number', default: 0.7 },
                    },
                },
            },
            required: ['name', 'model_config'],
        },
    },
    {
        name: 'skill.list',
        description: 'List all available skills with name, description, and interface schema',
        inputSchema: {
            type: 'object',
            properties: {
                filter: { type: 'string', description: 'Optional: filter by tag' },
            },
        },
    },
    {
        name: 'skill.schema',
        description: "Get the complete input/output interface contract for a specific skill",
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
            },
            required: ['name'],
        },
    },
    {
        name: 'skill.invoke',
        description: 'Invoke a CodeSquad skill by name with arguments',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: "Skill name, e.g. 'adopt', 'code-review'" },
                arguments: { type: 'object', description: 'Skill-specific arguments' },
                context: {
                    type: 'object',
                    properties: {
                        gdd: { type: 'string' },
                        code: { type: 'string' },
                        workspace_root: { type: 'string' },
                    },
                },
                model_config: {
                    type: 'object',
                    required: ['provider', 'api_key', 'model'],
                    properties: {
                        provider: { type: 'string' },
                        api_key: { type: 'string' },
                        model: { type: 'string' },
                        base_url: { type: 'string' },
                        max_tokens: { type: 'number' },
                        temperature: { type: 'number' },
                    },
                },
            },
            required: ['name', 'model_config'],
        },
    },
];
/** Agent tool names */
const AGENT_TOOLS = new Set(['agent.list', 'agent.schema', 'agent.invoke']);
/** Skill tool names */
const SKILL_TOOLS = new Set(['skill.list', 'skill.schema', 'skill.invoke']);
import { writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
export class CodeSquadMCPServer {
    transport;
    config;
    projectRoot;
    pidPath;
    _disabled = false;
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.config = loadMcpConfig(projectRoot);
        this.transport = new StdioTransport();
        this.pidPath = join(projectRoot, '.codebuddy', 'agent-memory', 'codesquad-mcp.pid');
        this._disabled = this.config.disabled === true;
    }
    /** Start the MCP server on stdio */
    start() {
        // P0 fix: respect disabled flag — no-op when MCP is disabled.
        if (this._disabled) {
            this.transport.log('CodeSquad MCP Server is disabled — not starting');
            return false;
        }
        if (this.transport.isRunning)
            return false;
        this.writePidFile();
        this.transport.start((request) => this.handleRequest(request), (notification) => this.handleNotification(notification));
        this.transport.log('CodeSquad MCP Server started');
        return true;
    }
    /** Stop the MCP server */
    stop() {
        this.cleanupPidFile();
        this.transport.stop();
        this.transport.log('CodeSquad MCP Server stopped');
        return true;
    }
    /** P0 fix: Disable MCP — stops if running and prevents future starts */
    disable() {
        this._disabled = true;
        this.stop();
        this.transport.log('CodeSquad MCP Server disabled');
        return true;
    }
    /** P0 fix: Re-enable MCP — allows start() to work again */
    enable() {
        this._disabled = false;
        this.transport.log('CodeSquad MCP Server re-enabled');
        return true;
    }
    /** Write PID file (D-16) */
    writePidFile() {
        try {
            const dir = join(this.projectRoot, '.codebuddy', 'agent-memory');
            if (!existsSync(dir))
                mkdirSync(dir, { recursive: true });
            const pidInfo = `pid=${process.pid}\ntransport=stdio\nstarted=${new Date().toISOString()}\n`;
            writeFileSync(this.pidPath, pidInfo, 'utf-8');
            // Auto-cleanup on exit
            process.on('exit', () => this.cleanupPidFile());
            return true;
        }
        catch {
            // PID write failure is non-fatal
            return false;
        }
    }
    /** Remove PID file on shutdown */
    cleanupPidFile() {
        try {
            if (existsSync(this.pidPath))
                unlinkSync(this.pidPath);
            return true;
        }
        catch {
            // Cleanup failure is non-fatal
            return false;
        }
    }
    /** Handle incoming MCP requests */
    async handleRequest(request) {
        const id = request.id ?? null;
        try {
            switch (request.method) {
                case 'initialize':
                    return this.handleInitialize(id);
                case 'tools/list':
                    return this.handleToolsList(id);
                case 'tools/call':
                    return await this.handleToolsCall(id, request.params);
                case 'ping':
                    return { jsonrpc: '2.0', id, result: {} };
                default:
                    return {
                        jsonrpc: '2.0',
                        id,
                        error: { code: -32601, message: `Method not found: ${request.method}` },
                    };
            }
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            return {
                jsonrpc: '2.0',
                id,
                error: { code: -32603, message: error.message },
            };
        }
    }
    /** Handle initialize — capability negotiation */
    handleInitialize(id) {
        const result = {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: {},
            },
            serverInfo: {
                name: 'codesquad-mcp',
                version: '0.1.0',
            },
        };
        return { jsonrpc: '2.0', id, result };
    }
    /** Handle tools/list — return all available tools */
    handleToolsList(id) {
        const result = {
            tools: ALL_TOOLS,
        };
        return { jsonrpc: '2.0', id, result };
    }
    /** Handle tools/call — execute a tool */
    async handleToolsCall(id, params) {
        if (!params || typeof params.name !== 'string') {
            return {
                jsonrpc: '2.0',
                id,
                error: { code: -32602, message: 'Invalid params: missing tool name' },
            };
        }
        const toolName = params.name;
        const args = (params.arguments ?? {});
        // Dispatch to discovery tools
        const discoveryResult = handleDiscoveryTool(toolName, args);
        if (discoveryResult) {
            return { jsonrpc: '2.0', id, result: discoveryResult };
        }
        // Dispatch to agent tools (async for agent.invoke)
        if (AGENT_TOOLS.has(toolName)) {
            const agentResult = await handleAgentTool(toolName, args);
            if (agentResult) {
                return { jsonrpc: '2.0', id, result: agentResult };
            }
        }
        // Dispatch to skill tools
        if (SKILL_TOOLS.has(toolName)) {
            const skillResult = await handleSkillTool(toolName, args);
            if (skillResult) {
                return { jsonrpc: '2.0', id, result: skillResult };
            }
        }
        return {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Tool not found: ${toolName}` },
        };
    }
    /** Handle incoming notifications */
    handleNotification(notification) {
        switch (notification.method) {
            case 'initialized':
                this.transport.log('Client initialized');
                return true;
            case 'notifications/cancelled':
                return true;
            default:
                this.transport.log(`Unhandled notification: ${notification.method}`);
                return false;
        }
    }
    /** Reload configuration */
    reloadConfig(projectRoot) {
        this.config = loadMcpConfig(projectRoot);
        this._disabled = this.config.disabled === true;
        return true;
    }
}
//# sourceMappingURL=server.js.map