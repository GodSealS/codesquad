/**
 * Setup Engine Core
 *
 * Equivalent of the /setup-engine skill for the CLI.
 * Handles engine selection, config updates, directory scaffolding,
 * and engine reference doc generation.
 */
export type EngineName = 'godot' | 'unity' | 'unreal' | 'cocos' | 'custom';
export type GodotLang = 'gdscript' | 'csharp' | 'both';
export type KnowledgeRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export interface EngineConfig {
    engine: EngineName;
    version: string;
    language: string;
}
export interface SetupEngineOptions {
    targetPath?: string;
    engine?: string;
    version?: string;
}
export declare const ENGINE_META: Record<EngineName, {
    display: string;
    languages: string[];
    defaultLang: string;
}>;
export declare function runSetupEngine(options?: SetupEngineOptions): Promise<void>;
//# sourceMappingURL=setup-engine-core.d.ts.map