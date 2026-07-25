/**
 * MCP Bridge — wraps MCP tools as CodeSquad Tool instances.
 *
 * Connects existing src/mcp/ infrastructure to the Chat tool pool.
 * MCP tools appear alongside built-in tools in the tool registry.
 *
 * References:
 *   Claude Code src/tools/MCPTool.ts
 *
 * Phase 7.0
 */
import { z } from 'zod';
import { buildTool } from './types.js';
/** Runtime-owned MCP handler registry and tool-wrapper factory. */
export class MCPBridge {
    toolHandlers = new Map();
    registerMCPToolHandler(serverName, toolName, handler) {
        if (!this.toolHandlers.has(serverName)) {
            this.toolHandlers.set(serverName, new Map());
        }
        this.toolHandlers.get(serverName).set(toolName, handler);
    }
    unregisterMCPServer(serverName) {
        this.toolHandlers.delete(serverName);
    }
    clear() {
        this.toolHandlers.clear();
    }
    /** Create a wrapper bound to this bridge's handler registry. */
    createMCPToolWrapper(def, serverName) {
        const toolName = `mcp__${serverName}__${def.name}`;
        const schema = mcpSchemaToZod(def.inputSchema);
        const bridge = this;
        return buildTool({
            name: toolName,
            description: `[MCP:${serverName}] ${def.description}`,
            searchHint: `mcp ${serverName} ${def.name}`,
            inputSchema: schema,
            isReadOnly: () => false,
            isConcurrencySafe: () => true,
            isDestructive: () => false,
            prompt: () => [
                `### ${toolName} (via MCP: ${serverName})`,
                '',
                def.description,
                '',
                'This tool is provided by an external MCP server.',
            ].join('\n'),
            descriptionFor: (input) => `MCP ${serverName}/${def.name}: ${JSON.stringify(input).slice(0, 100)}`,
            validateInput: (_input, _context) => ({ valid: true }),
            async call(input, _context) {
                try {
                    const result = await bridge.invokeMCPTool(serverName, def.name, input);
                    return {
                        toolCallId: '',
                        output: result,
                        content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
                    };
                }
                catch (err) {
                    return {
                        toolCallId: '',
                        output: null,
                        content: `[MCP Error] ${serverName}/${def.name}: ${err.message}`,
                        isError: true,
                    };
                }
            },
        });
    }
    async invokeMCPTool(serverName, toolName, input) {
        const server = this.toolHandlers.get(serverName);
        if (!server)
            throw new Error(`MCP server "${serverName}" not connected.`);
        const handler = server.get(toolName);
        if (!handler)
            throw new Error(`MCP tool "${toolName}" not found on server "${serverName}".`);
        return handler(input);
    }
}
// Compatibility exports remain process-global until their callers migrate.
const defaultMCPBridge = new MCPBridge();
export function createMCPToolWrapper(def, serverName) {
    return defaultMCPBridge.createMCPToolWrapper(def, serverName);
}
export function registerMCPToolHandler(serverName, toolName, handler) {
    defaultMCPBridge.registerMCPToolHandler(serverName, toolName, handler);
}
export function unregisterMCPServer(serverName) {
    defaultMCPBridge.unregisterMCPServer(serverName);
}
// ── Schema Conversion ──
/**
 * Convert MCP JSON Schema to Zod schema (simplified).
 */
function mcpSchemaToZod(schema) {
    if (!schema || Object.keys(schema).length === 0) {
        return z.object({});
    }
    const properties = (schema.properties || {});
    const required = (schema.required || []);
    const shape = {};
    for (const [key, prop] of Object.entries(properties)) {
        let zodType;
        switch (prop.type) {
            case 'string':
                zodType = z.string();
                if (prop.description)
                    zodType = zodType.describe(prop.description);
                break;
            case 'number':
            case 'integer':
                zodType = z.number();
                if (prop.description)
                    zodType = zodType.describe(prop.description);
                break;
            case 'boolean':
                zodType = z.boolean();
                break;
            case 'array':
                zodType = z.array(z.any());
                break;
            case 'object':
                zodType = z.object({}).passthrough();
                break;
            default:
                zodType = z.any();
        }
        if (!required.includes(key)) {
            zodType = zodType.optional();
        }
        shape[key] = zodType;
    }
    return z.object(shape);
}
//# sourceMappingURL=MCPBridge.js.map