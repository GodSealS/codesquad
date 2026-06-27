/**
 * Tool Schema Converter — converts CodeSquad Tool to Anthropic/OpenAI native format.
 *
 * References:
 *   Claude Code src/utils/api.ts — toolToAPISchema()
 *
 * Feature 1.2 — P4 Tool Use native mechanism
 */
// ── Conversion ──
/**
 * Convert a CodeSquad Tool to an Anthropic/OpenAI native tool schema.
 * Extracts Zod schema shape and converts to JSON Schema.
 *
 * Works with Zod v4: uses _zod properties for schema introspection.
 */
export function toolToNativeSchema(tool) {
    const jsonSchema = zodToSimpleJsonSchema(tool.inputSchema);
    return {
        name: tool.name,
        description: tool.prompt(),
        input_schema: {
            type: 'object',
            properties: jsonSchema.properties || {},
            required: jsonSchema.required || [],
        },
    };
}
/**
 * Convert all tools in pool to native schemas.
 */
export function toolsToNativeSchemas(tools) {
    return tools.map(toolToNativeSchema);
}
/**
 * Convert a Zod v4 schema to a simplified JSON Schema object.
 * Works with ZodObject, ZodString, ZodNumber, ZodBoolean, ZodArray, ZodEnum, ZodOptional.
 */
function zodToSimpleJsonSchema(schema) {
    const s = schema;
    // Zod v4: schemas have a `_zod` property or `_def` with type info
    const def = (s._def || s._zod?.def);
    const typeName = def?.typeName || s.typeName || '';
    switch (typeName) {
        case 'ZodObject': {
            const shape = def?.shape;
            if (!shape)
                return { type: 'object', properties: {} };
            const properties = {};
            const required = [];
            for (const [key, value] of Object.entries(shape)) {
                const propSchema = zodToSimpleJsonSchema(value);
                // Check if this field is optional (ZodOptional wraps)
                const v = value;
                const vDef = (v._def || v._zod?.def);
                const isOptional = vDef?.typeName === 'ZodOptional';
                if (!isOptional) {
                    required.push(key);
                }
                // Unwrap ZodOptional to get inner type
                if (isOptional && vDef?.innerType) {
                    const inner = zodToSimpleJsonSchema(vDef.innerType);
                    properties[key] = {
                        ...inner,
                        description: vDef?.description || propSchema.description,
                    };
                }
                else {
                    properties[key] = propSchema;
                }
            }
            // Zod v4: check for ZodDefault (has ._def.defaultValue)
            const actualRequired = required.filter((key) => {
                const field = shape[key];
                const fDef = (field?._def || field?._zod?.def);
                // Has default value → not required
                if (fDef?.defaultValue !== undefined)
                    return false;
                return true;
            });
            return {
                type: 'object',
                properties,
                required: actualRequired.length > 0 ? actualRequired : undefined,
                description: def?.description,
            };
        }
        case 'ZodString':
            return {
                type: 'string',
                description: def?.description,
            };
        case 'ZodNumber':
            return {
                type: 'number',
                description: def?.description,
            };
        case 'ZodBoolean':
            return {
                type: 'boolean',
                description: def?.description,
            };
        case 'ZodEnum': {
            const values = def?.values;
            return {
                type: 'string',
                enum: values,
                description: def?.description,
            };
        }
        case 'ZodArray': {
            const innerType = def?.type;
            return {
                type: 'array',
                items: innerType ? zodToSimpleJsonSchema(innerType) : { type: 'string' },
                description: def?.description,
            };
        }
        case 'ZodOptional': {
            // Should be handled at parent level, but just in case
            const inner = def?.innerType;
            return inner ? zodToSimpleJsonSchema(inner) : { type: 'string' };
        }
        case 'ZodDefault': {
            const inner = def?.innerType;
            return inner ? zodToSimpleJsonSchema(inner) : { type: 'string' };
        }
        default:
            // Fallback: try to inspect the schema shape
            if (typeof s.parse === 'function') {
                return { type: 'string' };
            }
            return { type: 'string' };
    }
}
//# sourceMappingURL=schema-converter.js.map