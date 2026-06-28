/**
 * Configuration Schemas
 *
 * Zod schemas for validating codesquad.config.yaml and models.config.yaml.
 */
import { z } from 'zod';
/** Schema for codesquad.config.yaml */
export const ProjectConfigSchema = z.object({
    version: z.number().default(1),
    tools: z.array(z.string()).default([]),
    engine: z
        .object({
        name: z.string().default('custom'),
        version: z.string().default(''),
    })
        .default({ name: 'custom', version: '' }),
    generation: z
        .object({
        overwriteOnUpdate: z.boolean().default(true),
        skipSettings: z.boolean().default(false),
    })
        .default({ overwriteOnUpdate: true, skipSettings: false }),
});
/** Default project configuration */
export const DEFAULT_PROJECT_CONFIG = {
    version: 1,
    tools: [],
    engine: {
        name: 'custom',
        version: '',
    },
    generation: {
        overwriteOnUpdate: true,
        skipSettings: false,
    },
};
/** Schema for ModelOverride: either a plain string or a {model, source} object */
export const ModelOverrideSchema = z.union([z.string(), z.object({ model: z.string(), source: z.string() })]);
/** Schema for ApiEndpoint */
export const ApiEndpointSchema = z.object({
    provider: z.enum(['openai-compatible', 'openai', 'anthropic', 'deepseek', 'kimi', 'gemini', 'custom']).optional(),
    baseUrl: z.string().optional(),
    apiKey: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
});
/** Schema for models.config.yaml */
export const ModelsConfigSchema = z.object({
    version: z.number().default(1),
    agents: z.record(z.string(), ModelOverrideSchema).optional(),
    skills: z.record(z.string(), ModelOverrideSchema).optional(),
    batch: z.record(z.string(), z.string()).optional(),
    default: z.string().nullable().optional(),
    api: z.object({
        sources: z.record(z.string(), ApiEndpointSchema).default({}),
    }).default({ sources: {} }),
});
/** Default models configuration */
export const DEFAULT_MODELS_CONFIG = {
    version: 1,
    agents: {},
    skills: {},
    batch: {},
    default: null,
    api: { sources: {} },
};
/** Schema for global config (~/.codesquad/config.json) */
export const GlobalConfigSchema = z.object({
    /** Default AI tools (applied when --tools not specified) */
    defaultTools: z.array(z.string()).default(['codebuddy']),
    /** Default model across all agents/skills */
    defaultModel: z.string().nullable().default(null),
    /** Telemetry enabled */
    telemetryEnabled: z.boolean().default(true),
    /** Last update check timestamp */
    lastUpdateCheck: z.string().nullable().default(null),
});
export const DEFAULT_GLOBAL_CONFIG = {
    defaultTools: ['codebuddy'],
    defaultModel: null,
    telemetryEnabled: true,
    lastUpdateCheck: null,
};
//# sourceMappingURL=config.schema.js.map