/**
 * MCP Server — Discovery Tools
 *
 * Implements:
 *   - codesquad.status  — agent/skill counts, health, version
 *   - codesquad.search  — search agents and skills by keyword/tag
 */
import type { MCPCallToolResult } from '../transport/types.js';
/** Invalidate cache (e.g., after init/update) */
export declare function invalidateStubCache(): void;
/** Discovery tool definitions for tools/list */
export declare const DISCOVERY_TOOLS: ({
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
})[];
/** Route a discovery tool call */
export declare function handleDiscoveryTool(toolName: string, params?: Record<string, unknown>): MCPCallToolResult | null;
//# sourceMappingURL=discovery-tools.d.ts.map