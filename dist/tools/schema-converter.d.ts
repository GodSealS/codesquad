/**
 * Tool Schema Converter — converts CodeSquad Tool to Anthropic/OpenAI native format.
 *
 * References:
 *   Claude Code src/utils/api.ts — toolToAPISchema()
 *
 * Feature 1.2 — P4 Tool Use native mechanism
 */
import type { Tool } from './types.js';
export interface NativeToolSchema {
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}
/**
 * Convert a CodeSquad Tool to an Anthropic/OpenAI native tool schema.
 * Extracts Zod schema shape and converts to JSON Schema.
 *
 * Works with Zod v4: uses _zod properties for schema introspection.
 */
export declare function toolToNativeSchema(tool: Tool): NativeToolSchema;
/**
 * Convert all tools in pool to native schemas.
 */
export declare function toolsToNativeSchemas(tools: readonly Tool[]): NativeToolSchema[];
//# sourceMappingURL=schema-converter.d.ts.map