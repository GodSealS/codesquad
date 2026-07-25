export type ModelsConfigSource = 'workspace' | 'legacy';
export interface LoadedModelsConfig {
    content: string;
    source: ModelsConfigSource;
    path: string;
}
/**
 * Authoritative workspace configuration access.
 * Legacy root-level config remains readable for backwards compatibility only.
 */
export declare class ConfigRepository {
    private readonly projectRoot;
    constructor(projectRoot: string);
    get modelsConfigPath(): string;
    get legacyModelsConfigPath(): string;
    readModelsConfig(): LoadedModelsConfig | null;
    writeModelsConfig(content: string): void;
}
//# sourceMappingURL=config-repository.d.ts.map