/**
 * Manifest management — read/write AICore/.codesquad/manifest.yaml.
 */
import type { RegistryManifest, RegistryEntry, RegistryCategory } from './types.js';
/** Read the manifest, or null if not found. */
export declare function readManifest(aicoreRoot: string): RegistryManifest | null;
/** Write manifest to disk. */
export declare function writeManifest(aicoreRoot: string, manifest: RegistryManifest): void;
/** Ensure manifest exists, creating default if missing. */
export declare function ensureManifest(aicoreRoot: string): RegistryManifest;
/** Add/update entries (deduplicates by name+category). */
export declare function addEntriesToManifest(aicoreRoot: string, entries: RegistryEntry[]): void;
/** Remove entries by name+category. */
export declare function removeEntriesFromManifest(aicoreRoot: string, category: RegistryCategory, names: string[]): void;
/** Update AICore metadata. */
export declare function updateAicoreMeta(aicoreRoot: string, version: string, entryCount: number): void;
/** Find entries not overridden by higher-priority layer. */
export declare function findOverrides(baseEntries: RegistryEntry[], overrideEntries: RegistryEntry[]): RegistryEntry[];
//# sourceMappingURL=manifest.d.ts.map