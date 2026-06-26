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
// ── Dynamic MCP tool creation ──
/**
 * Create a CodeSquad Tool wrapper for an MCP tool.
 * The tool name is prefixed with "mcp__" to prevent collisions.
 */
export function createMCPToolWrapper(def, serverName) {
    const toolName = `mcp__${serverName}__${def.name}`;
    // Build a simple Zod schema from MCP JSON Schema
    const schema = mcpSchemaToZod(def.inputSchema);
    return buildTool({
        name: toolName,
        description: `[MCP:${serverName}] ${def.description}`,
        searchHint: `mcp ${serverName} ${def.name}`,
        inputSchema: schema,
        isReadOnly() {
            // MCP tools are assumed writable unless proven otherwise
            return false;
        },
        isConcurrencySafe() {
            return true;
        },
        isDestructive() {
            return false; // Conservative default
        },
        prompt() {
            return [
                `### ${toolName} (via MCP: ${serverName})`,
                '',
                def.description,
                '',
                'This tool is provided by an external MCP server.',
            ].join('\n');
        },
        descriptionFor(input) {
            return `MCP ${serverName}/${def.name}: ${JSON.stringify(input).slice(0, 100)}`;
        },
        validateInput(_input, _context) {
            return { valid: true }; // Schema validation is handled by Zod
        },
        async call(input, _context) {
            try {
                const result = await invokeMCPTool(serverName, def.name, input);
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
// ── MCP Tool Invocation ──
let _mcpToolHandlers = new Map();
/**
 * Register an MCP tool handler.
 * Called by the MCP client when tools are discovered.
 */
export function registerMCPToolHandler(serverName, toolName, handler) {
    if (!_mcpToolHandlers.has(serverName)) {
        _mcpToolHandlers.set(serverName, new Map());
    }
    _mcpToolHandlers.get(serverName).set(toolName, handler);
}
/**
 * Remove all handlers for a server (on disconnect).
 */
export function unregisterMCPServer(serverName) {
    _mcpToolHandlers.delete(serverName);
}
async function invokeMCPTool(serverName, toolName, input) {
    const server = _mcpToolHandlers.get(serverName);
    if (!server) {
        throw new Error(`MCP server "${serverName}" not connected.`);
    }
    const handler = server.get(toolName);
    if (!handler) {
        throw new Error(`MCP tool "${toolName}" not found on server "${serverName}".`);
    }
    return handler(input);
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