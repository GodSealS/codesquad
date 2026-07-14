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
    // 语义过滤相似度百分比：默认 35%（内部转为 cosine threshold 0.35）
    similarityThresholdPercent: 35,
    // 匹配源上下文条数：查询向量 + 语义过滤激活门槛，默认 5
    queryContextLength: 5,
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
    cliSmartEnhancement: false,
    maxGenerationPercent: 50,
    semanticContext: DEFAULT_SEMANTIC_CONTEXT,
    memorySummaryMode: 'regex',
    autoCompactEnabled: true,
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
            cliSmartEnhancement: DEFAULTS.cliSmartEnhancement,
            maxGenerationPercent: DEFAULTS.maxGenerationPercent,
            memorySummaryMode: DEFAULTS.memorySummaryMode,
            autoCompactEnabled: DEFAULTS.autoCompactEnabled,
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
            cliSmartEnhancement: parsed.cliSmartEnhancement ?? DEFAULTS.cliSmartEnhancement,
            maxGenerationPercent: clampGenPercent(parsed.maxGenerationPercent ?? DEFAULTS.maxGenerationPercent),
            memorySummaryMode: parsed.memorySummaryMode ?? DEFAULTS.memorySummaryMode,
            autoCompactEnabled: parsed.autoCompactEnabled ?? DEFAULTS.autoCompactEnabled,
            semanticContext: deepMergeSemanticConfig(parsed.semanticContext),
        };
    }
    catch (err) {
        console.error(`[settings] Failed to parse ~/.codesquad/config.json: ${err.message}, using defaults`);
        // Bug Fix #9: Deep copy defaults to prevent shared reference mutation
        return {
            memoryLimitChats: DEFAULTS.memoryLimitChats,
            hasCraftConfirmed: DEFAULTS.hasCraftConfirmed,
            streamingEnabled: DEFAULTS.streamingEnabled,
            cliSmartEnhancement: DEFAULTS.cliSmartEnhancement,
            maxGenerationPercent: DEFAULTS.maxGenerationPercent,
            memorySummaryMode: DEFAULTS.memorySummaryMode,
            autoCompactEnabled: DEFAULTS.autoCompactEnabled,
            semanticContext: {
                ...DEFAULTS.semanticContext,
                embeddingModel: { ...DEFAULTS.semanticContext.embeddingModel },
                features: { ...DEFAULTS.semanticContext.features },
            },
        };
    }
}
/** Save a partial update, validate ranges, and persist to disk.
 * @param partial New values to merge
 * @param current  Optional: pre-loaded current settings (avoids double I/O)
 */
export function saveSettings(partial, current) {
    const base = current ?? loadSettings();
    const merged = {
        ...base,
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
function clampGenPercent(n) {
    const num = Math.round(n);
    if (num < 30)
        return 30;
    if (num > 90)
        return 90;
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
        similarityThresholdPercent: partial.similarityThresholdPercent ?? def.similarityThresholdPercent,
        queryContextLength: partial.queryContextLength ?? def.queryContextLength,
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