/**
 * Manifest management — read/write AICore/.codesquad/manifest.yaml.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { getManifestPath } from './paths.js';
import { createEmptyManifest } from './types.js';
/** Read the manifest, or null if not found. */
export function readManifest(aicoreRoot) {
    const path = getManifestPath(aicoreRoot);
    if (!existsSync(path))
        return null;
    try {
        return parseYaml(readFileSync(path, 'utf-8'));
    }
    catch {
        return null;
    }
}
/** Write manifest to disk. */
export function writeManifest(aicoreRoot, manifest) {
    const path = getManifestPath(aicoreRoot);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, stringifyYaml(manifest), 'utf-8');
}
/** Ensure manifest exists, creating default if missing. */
export function ensureManifest(aicoreRoot) {
    let manifest = readManifest(aicoreRoot);
    if (!manifest) {
        manifest = createEmptyManifest('', '0.0.0');
        writeManifest(aicoreRoot, manifest);
    }
    return manifest;
}
/** Add/update entries (deduplicates by name+category). */
export function addEntriesToManifest(aicoreRoot, entries) {
    const manifest = ensureManifest(aicoreRoot);
    for (const entry of entries) {
        const idx = manifest.entries.findIndex(e => e.name === entry.name && e.category === entry.category);
        if (idx >= 0)
            manifest.entries[idx] = entry;
        else
            manifest.entries.push(entry);
    }
    writeManifest(aicoreRoot, manifest);
}
/** Remove entries by name+category. */
export function removeEntriesFromManifest(aicoreRoot, category, names) {
    const manifest = readManifest(aicoreRoot);
    if (!manifest)
        return;
    manifest.entries = manifest.entries.filter(e => !(e.category === category && names.includes(e.name)));
    writeManifest(aicoreRoot, manifest);
}
/** Update AICore metadata. */
export function updateAicoreMeta(aicoreRoot, version, entryCount) {
    const manifest = ensureManifest(aicoreRoot);
    manifest.aicore = { type: 'aicore', path: aicoreRoot, version, registeredAt: new Date().toISOString(), entryCount };
    writeManifest(aicoreRoot, manifest);
}
/** Find entries not overridden by higher-priority layer. */
export function findOverrides(baseEntries, overrideEntries) {
    const overrideNames = new Set(overrideEntries.map(e => `${e.category}:${e.name}`));
    return baseEntries.filter(e => !overrideNames.has(`${e.category}:${e.name}`));
}
//# sourceMappingURL=manifest.js.map