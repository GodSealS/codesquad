/**
 * User settings management.
 *
 * Stores persistent user preferences in ~/.codesquad/config.json.
 * Phase 8.1: Cross-chat memory limit configuration.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { codesquadHome } from './storage.js';
// ── Defaults ──
const DEFAULT_SEMANTIC_CONTEXT = {
    enabled: false,
    embeddingModel: { type: 'local-bge-m3' },
    contextMessageLimit: 20,
    similarityThreshold: 0.5,
    routingThreshold: 0.65,
    features: {
        semanticFilter: false,
        agentRouting: false,
        codeRAG: false,
        exampleInjection: false,
        docAssociation: false,
        toolDedup: false,
    },
};
const DEFAULTS = {
    memoryLimitChats: 5,
    hasCraftConfirmed: false,
    streamingEnabled: false,
    semanticContext: DEFAULT_SEMANTIC_CONTEXT,
};
const MIN_MEMORY_LIMIT = 2;
const MAX_MEMORY_LIMIT = 15;
// ── Paths ──
function configDir() {
    const dir = codesquadHome();
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    return dir;
}
function configPath() {
    return join(configDir(), 'config.json');
}
// ── Load / Save ──
/** Load user settings, merging with defaults for missing fields. */
export function loadSettings() {
    const path = configPath();
    if (!existsSync(path)) {
        // 🔧 Bug Fix: deep copy defaults to prevent shared reference mutation
        return {
            memoryLimitChats: DEFAULTS.memoryLimitChats,
            hasCraftConfirmed: DEFAULTS.hasCraftConfirmed,
            streamingEnabled: DEFAULTS.streamingEnabled,
            semanticContext: {
                ...DEFAULTS.semanticContext,
                embeddingModel: { ...DEFAULTS.semanticContext.embeddingModel },
                features: { ...DEFAULTS.semanticContext.features },
            },
        };
    }
    try {
        const raw = readFileSync(path, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
            memoryLimitChats: clampMemoryLimit(parsed.memoryLimitChats ?? DEFAULTS.memoryLimitChats),
            hasCraftConfirmed: parsed.hasCraftConfirmed ?? DEFAULTS.hasCraftConfirmed,
            streamingEnabled: parsed.streamingEnabled ?? DEFAULTS.streamingEnabled,
            semanticContext: deepMergeSemanticConfig(parsed.semanticContext),
        };
    }
    catch (err) {
        console.error(`[settings] Failed to parse ~/.codesquad/config.json: ${err.message}, using defaults`);
        return { ...DEFAULTS };
    }
}
/** Save a partial update, validate ranges, and persist to disk. */
export function saveSettings(partial) {
    const current = loadSettings();
    const merged = {
        ...current,
        ...partial,
    };
    // Validate and clamp
    if ('memoryLimitChats' in partial) {
        merged.memoryLimitChats = clampMemoryLimit(merged.memoryLimitChats);
    }
    // configDir() already ensures the directory exists
    configDir();
    writeFileSync(configPath(), JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
}
/** Shortcut to get the current memory limit. */
export function getMemoryLimit() {
    return loadSettings().memoryLimitChats;
}
// ── Helpers ──
function clampMemoryLimit(n) {
    const num = Math.round(n);
    if (num < MIN_MEMORY_LIMIT)
        return MIN_MEMORY_LIMIT;
    if (num > MAX_MEMORY_LIMIT)
        return MAX_MEMORY_LIMIT;
    return num;
}
/** Deep-merge partial semantic config with defaults. */
function deepMergeSemanticConfig(partial) {
    const def = DEFAULT_SEMANTIC_CONTEXT;
    if (!partial)
        return { ...def, features: { ...def.features } };
    return {
        enabled: partial.enabled ?? def.enabled,
        embeddingModel: {
            type: partial.embeddingModel?.type ?? def.embeddingModel.type,
            modelId: partial.embeddingModel?.modelId ?? def.embeddingModel.modelId,
        },
        contextMessageLimit: partial.contextMessageLimit ?? def.contextMessageLimit,
        similarityThreshold: partial.similarityThreshold ?? def.similarityThreshold,
        routingThreshold: partial.routingThreshold ?? def.routingThreshold,
        features: {
            semanticFilter: partial.features?.semanticFilter ?? def.features.semanticFilter,
            agentRouting: partial.features?.agentRouting ?? def.features.agentRouting,
            codeRAG: partial.features?.codeRAG ?? def.features.codeRAG,
            exampleInjection: partial.features?.exampleInjection ?? def.features.exampleInjection,
            docAssociation: partial.features?.docAssociation ?? def.features.docAssociation,
            toolDedup: partial.features?.toolDedup ?? def.features.toolDedup,
        },
    };
}
//# sourceMappingURL=settings.js.map