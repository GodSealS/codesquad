/**
 * Configuration Schemas
 *
 * Zod schemas for validating codesquad.config.yaml and models.config.yaml.
 */
import { z } from 'zod';
/** Schema for codesquad.config.yaml */
export declare const ProjectConfigSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodNumber>;
    tools: z.ZodDefault<z.ZodArray<z.ZodString>>;
    engine: z.ZodDefault<z.ZodObject<{
        name: z.ZodDefault<z.ZodString>;
        version: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
    generation: z.ZodDefault<z.ZodObject<{
        overwriteOnUpdate: z.ZodDefault<z.ZodBoolean>;
        skipSettings: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
/** Default project configuration */
export declare const DEFAULT_PROJECT_CONFIG: ProjectConfig;
/** Schema for ModelOverride: either a plain string or a {model, source} object */
export declare const ModelOverrideSchema: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
    model: z.ZodString;
    source: z.ZodString;
}, z.core.$strip>]>;
/** Schema for ApiEndpoint */
export declare const ApiEndpointSchema: z.ZodObject<{
    provider: z.ZodOptional<z.ZodEnum<{
        anthropic: "anthropic";
        "openai-compatible": "openai-compatible";
        custom: "custom";
    }>>;
    baseUrl: z.ZodOptional<z.ZodString>;
    apiKey: z.ZodOptional<z.ZodString>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
/** Schema for models.config.yaml */
export declare const ModelsConfigSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodNumber>;
    agents: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        model: z.ZodString;
        source: z.ZodString;
    }, z.core.$strip>]>>>;
    skills: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        model: z.ZodString;
        source: z.ZodString;
    }, z.core.$strip>]>>>;
    batch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    default: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    api: z.ZodDefault<z.ZodObject<{
        sources: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
            provider: z.ZodOptional<z.ZodEnum<{
                anthropic: "anthropic";
                "openai-compatible": "openai-compatible";
                custom: "custom";
            }>>;
            baseUrl: z.ZodOptional<z.ZodString>;
            apiKey: z.ZodOptional<z.ZodString>;
            headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;
/** Default models configuration */
export declare const DEFAULT_MODELS_CONFIG: ModelsConfig;
/** Schema for global config (~/.codesquad/config.json) */
export declare const GlobalConfigSchema: z.ZodObject<{
    defaultTools: z.ZodDefault<z.ZodArray<z.ZodString>>;
    defaultModel: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    telemetryEnabled: z.ZodDefault<z.ZodBoolean>;
    lastUpdateCheck: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
export declare const DEFAULT_GLOBAL_CONFIG: GlobalConfig;
//# sourceMappingURL=config.schema.d.ts.map