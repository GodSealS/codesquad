/**
 * Registry types — two-layer registration system.
 *
 * Layers (priority: project > user):
 *   1. User-level  — .codesquad/agents/ skills/ rules/ hooks/ (built-in + external registrations)
 *   2. Project-level — <project>/.codesquad/agents/ skills/ rules/ hooks/ (project overrides)
 *
 * External CLIs register their agents/skills/rules/hooks into user-level (.codesquad/)
 * via `codesquad register` commands.
 */
/** Category of registered content. */
export type RegistryCategory = 'agent' | 'skill' | 'rule' | 'hook';
/** Subdirectory name for each category. */
export declare const CATEGORY_DIRS: Record<RegistryCategory, string>;
/** File extension for each category. */
export declare const CATEGORY_EXT: Record<RegistryCategory, string>;
/** Source type of a registered entry. */
export type SourceType = 'aicore' | 'external' | 'project';
/** Metadata for a single registered entry. */
export interface RegistryEntry {
    name: string;
    category: RegistryCategory;
    source: SourceType;
    externalSource?: string;
    registeredAt: string;
    version?: string;
    sourcePath: string;
}
/** External source descriptor. */
export interface ExternalSource {
    name: string;
    type: 'external';
    path: string;
    version?: string;
    registeredAt: string;
    entryCount?: number;
}
/** Registry manifest (stored at .codesquad/.codesquad/manifest.yaml). */
export interface RegistryManifest {
    version: 1;
    /** .codesquad built-in info. */
    aicore: {
        type: 'aicore';
        path: string;
        version: string;
        registeredAt: string;
        entryCount: number;
    };
    externalSources: ExternalSource[];
    entries: RegistryEntry[];
}
export interface RegisterSourceOptions {
    name: string;
    path: string;
    version?: string;
    force?: boolean;
}
export interface RegisterEntryOptions {
    category: RegistryCategory;
    name: string;
    source: string;
    sourcePath: string;
    version?: string;
}
export interface RegisterResult {
    count: number;
    updated: number;
    skipped: number;
    errors: string[];
}
export declare function createEmptyManifest(aicorePath: string, aicoreVersion: string): RegistryManifest;
//# sourceMappingURL=types.d.ts.map