/**
 * Models Config Manager
 *
 * Read/write models.config.yaml with per-agent, per-skill, and batch model mappings.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { ModelsConfigSchema, DEFAULT_MODELS_CONFIG } from '../schemas/config.schema.js';
import { writeYaml } from '../utils/yaml.js';
import { loadProjectConfig } from './project-config.js';
import { getAdapter } from '../adapters/index.js';
/** Extract source name from a ModelOverride; returns undefined if plain string */
function getSourceName(ov) {
    return typeof ov === 'string' ? undefined : ov.source;
}
/** Validate that all source references in agents/skills point to existing api.sources */
export function validateSourceReferences(config) {
    const warnings = [];
    const knownSources = new Set(Object.keys(config.api?.sources ?? {}));
    for (const [name, ov] of Object.entries(config.agents ?? {})) {
        const src = getSourceName(ov);
        if (src && !knownSources.has(src)) {
            warnings.push(`Agent '${name}' references source '${src}' which does not exist in api.sources`);
        }
    }
    for (const [name, ov] of Object.entries(config.skills ?? {})) {
        const src = getSourceName(ov);
        if (src && !knownSources.has(src)) {
            warnings.push(`Skill '${name}' references source '${src}' which does not exist in api.sources`);
        }
    }
    return warnings;
}
/** Deep-clone a ModelsConfig to avoid shared-reference pollution */
function deepCloneConfig(cfg) {
    return {
        version: cfg.version,
        agents: cfg.agents ? { ...cfg.agents } : undefined,
        skills: cfg.skills ? { ...cfg.skills } : undefined,
        batch: cfg.batch ? { ...cfg.batch } : undefined,
        default: cfg.default,
        api: {
            sources: Object.fromEntries(Object.entries(cfg.api.sources).map(([k, v]) => [k, { ...v }])),
        },
    };
}
/** Load models.config.yaml from a project directory */
export function loadModelsConfig(projectPath) {
    const configPath = join(projectPath, 'models.config.yaml');
    if (!existsSync(configPath)) {
        return deepCloneConfig(DEFAULT_MODELS_CONFIG);
    }
    try {
        const raw = readFileSync(configPath, 'utf-8');
        const parsed = parseYaml(raw);
        return {
            version: parsed.version ?? DEFAULT_MODELS_CONFIG.version,
            agents: parsed.agents ?? {},
            skills: parsed.skills ?? {},
            batch: parsed.batch ?? {},
            default: parsed.default ?? null,
            api: parsed.api ?? { sources: {} },
        };
    }
    catch {
        return deepCloneConfig(DEFAULT_MODELS_CONFIG);
    }
}
/** Save models.config.yaml to a project directory */
export function saveModelsConfig(projectPath, config) {
    writeYaml(join(projectPath, 'models.config.yaml'), config);
}
/** Merge multiple tool default mappings: first-selected tool wins */
export function computeToolDefaultModels(toolIds) {
    const merged = {
        version: 1,
        agents: {},
        skills: {},
        batch: {},
        default: null,
        api: { sources: {} },
    };
    for (const toolId of toolIds) {
        const adapter = getAdapter(toolId);
        if (!adapter?.getDefaultModels)
            continue;
        const defaults = adapter.getDefaultModels();
        // Later (right-hand) wins in spread → first-selected tool's values are preserved
        if (defaults.batch)
            merged.batch = { ...defaults.batch, ...merged.batch };
        if (defaults.agents)
            merged.agents = { ...defaults.agents, ...merged.agents };
        if (defaults.skills)
            merged.skills = { ...defaults.skills, ...merged.skills };
        if (defaults.default !== undefined && defaults.default !== null && merged.default === null) {
            merged.default = defaults.default;
        }
    }
    return merged;
}
/** Load existing or auto-generate defaults (only called during init, not bind) */
export function loadOrInitModelsConfig(projectPath, toolIds) {
    const configPath = join(projectPath, 'models.config.yaml');
    if (existsSync(configPath)) {
        return loadModelsConfig(projectPath);
    }
    const defaults = computeToolDefaultModels(toolIds);
    saveModelsConfig(projectPath, defaults);
    return defaults;
}
/** Set a per-agent model override */
export function setAgentModel(projectPath, agentName, override) {
    const config = loadModelsConfig(projectPath);
    if (!config.agents)
        config.agents = {};
    config.agents[agentName] = override;
    saveModelsConfig(projectPath, config);
}
/** Set a per-skill model override */
export function setSkillModel(projectPath, skillName, override) {
    const config = loadModelsConfig(projectPath);
    if (!config.skills)
        config.skills = {};
    config.skills[skillName] = override;
    saveModelsConfig(projectPath, config);
}
/** Set a batch pattern mapping */
export function setBatchMapping(projectPath, pattern, model) {
    const config = loadModelsConfig(projectPath);
    if (!config.batch)
        config.batch = {};
    config.batch[pattern] = model;
    saveModelsConfig(projectPath, config);
}
/** Set the default fallback model */
export function setDefaultModel(projectPath, model) {
    const config = loadModelsConfig(projectPath);
    config.default = model;
    saveModelsConfig(projectPath, config);
}
/** Reset models.config.yaml: restore tool-appropriate defaults if tools known, else empty */
export function resetModelsConfig(projectPath) {
    const toolIds = loadProjectConfig(projectPath).tools;
    const defaults = toolIds.length > 0
        ? computeToolDefaultModels(toolIds)
        : deepCloneConfig(DEFAULT_MODELS_CONFIG);
    saveModelsConfig(projectPath, defaults);
}
/** Set/update a single scalar field on api.sources[name] (provider, baseUrl, apiKey only; use setApiSourceHeaders for headers) */
export function setApiSourceField(projectPath, sourceName, fieldName, value) {
    const config = loadModelsConfig(projectPath);
    if (!config.api)
        config.api = { sources: {} };
    if (!config.api.sources[sourceName]) {
        config.api.sources[sourceName] = {};
    }
    if (value === undefined) {
        delete config.api.sources[sourceName][fieldName];
    }
    else {
        config.api.sources[sourceName][fieldName] = value;
    }
    saveModelsConfig(projectPath, config);
}
/** Set/update headers on api.sources[name] (replaces entire headers object) */
export function setApiSourceHeaders(projectPath, sourceName, headers) {
    const config = loadModelsConfig(projectPath);
    if (!config.api)
        config.api = { sources: {} };
    if (!config.api.sources[sourceName]) {
        config.api.sources[sourceName] = {};
    }
    config.api.sources[sourceName].headers = headers;
    saveModelsConfig(projectPath, config);
}
/** Delete an entire api.source entry */
export function removeApiSource(projectPath, sourceName) {
    const config = loadModelsConfig(projectPath);
    if (config.api?.sources) {
        delete config.api.sources[sourceName];
        saveModelsConfig(projectPath, config);
    }
}
/**
 * Import model config from an external YAML file, merging into the project's
 * models.config.yaml. The import file uses the same schema as models.config.yaml.
 *
 * Merge strategy (per-section):
 *   agents / skills / batch  — deep merge: new entries are added, existing keys are overwritten
 *   default                  — overwritten if non-null in import
 *   api.sources              — deep merge: new sources added, existing sources merged by field
 */
export function importModelsConfig(projectPath, importFilePath) {
    if (!existsSync(importFilePath)) {
        throw new Error(`Import file not found: ${importFilePath}`);
    }
    const raw = readFileSync(importFilePath, 'utf-8');
    let parsed;
    try {
        parsed = parseYaml(raw);
    }
    catch (e) {
        throw new Error(`Invalid YAML in import file: ${e instanceof Error ? e.message : String(e)}`);
    }
    const result = ModelsConfigSchema.safeParse(parsed);
    if (!result.success) {
        const issues = result.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
        throw new Error(`Import file validation failed:\n${issues}`);
    }
    const importCfg = result.data;
    const current = loadModelsConfig(projectPath);
    let added = 0;
    // Merge default
    if (importCfg.default !== null && importCfg.default !== undefined) {
        current.default = importCfg.default;
        added++;
    }
    // Merge agents
    if (importCfg.agents) {
        for (const [k, v] of Object.entries(importCfg.agents)) {
            if (v !== undefined) {
                if (!current.agents)
                    current.agents = {};
                current.agents[k] = v;
                added++;
            }
        }
    }
    // Merge skills
    if (importCfg.skills) {
        for (const [k, v] of Object.entries(importCfg.skills)) {
            if (v !== undefined) {
                if (!current.skills)
                    current.skills = {};
                current.skills[k] = v;
                added++;
            }
        }
    }
    // Merge batch
    if (importCfg.batch) {
        for (const [k, v] of Object.entries(importCfg.batch)) {
            if (v !== undefined) {
                if (!current.batch)
                    current.batch = {};
                current.batch[k] = v;
                added++;
            }
        }
    }
    // Merge api.sources
    if (importCfg.api?.sources) {
        if (!current.api)
            current.api = { sources: {} };
        if (!current.api.sources)
            current.api.sources = {};
        for (const [name, ep] of Object.entries(importCfg.api.sources)) {
            if (ep) {
                current.api.sources[name] = { ...current.api.sources[name], ...ep };
                added++;
            }
        }
    }
    // Validate source references after merge
    const warnings = validateSourceReferences(current);
    saveModelsConfig(projectPath, current);
    return { added, warnings };
}
const MODELS_TEMPLATE = `# =============================================================================
# Model Configuration Template
# =============================================================================
#
# This file controls which AI model each agent and skill uses.
# It supports per-agent, per-skill, batch-pattern, and API-source overrides.
#
# Usage examples:
#   codesquad config show                  # View current config
#   codesquad config set default gpt-4     # Set global default model
#   codesquad config set agent.game-designer claude-sonnet
#   codesquad config set skill.brainstorm claude-opus
#   codesquad config import my-models.yaml # Batch import from file
#
# Supported model identifiers:
#   - Plain string:  "claude-sonnet", "gpt-4", "gemini-pro"
#   - With source:   {model: "claude-sonnet", source: "my-proxy"}
#
# ======== Sections ========
#   agents      — Override model per agent name
#   skills      — Override model per skill name
#   batch       — Glob-pattern model mapping (matches model names, not agent/skill names)
#   default     — Fallback if no override matches
#   api.sources — Custom API endpoints (provider routing, base URL, headers)

version: 1

# ── Per-Agent Overrides ─────────────────────────────────────────────────────
# Override the model used by specific agents.
# Supports 38 agents. Add entries as needed; the project will use defaults for
# any agent not listed here.
agents:
  # Core design agents
  game-designer: claude-sonnet        # Replace with your preferred model
  narrative-director: claude-opus
  level-designer: gpt-4
  systems-designer: gpt-4
  economy-designer: claude-sonnet
  ux-designer: claude-sonnet
  art-director: claude-sonnet
  audio-director: claude-haiku
  writer: claude-sonnet
  world-builder: claude-sonnet
  creative-director: claude-opus

  # Programming agents
  lead-programmer: claude-sonnet
  gameplay-programmer: claude-sonnet
  engine-programmer: claude-sonnet
  ai-programmer: claude-sonnet
  network-programmer: claude-sonnet
  ui-programmer: claude-sonnet
  tools-programmer: claude-haiku
  technical-artist: gpt-4

  # Engine specialists
  unreal-specialist: claude-sonnet
  unity-specialist: claude-sonnet
  godot-specialist: claude-sonnet
  cocos-specialist: claude-sonnet

  # Production & QA
  producer: claude-haiku
  qa-lead: claude-haiku
  qa-tester: claude-haiku
  release-manager: claude-haiku
  community-manager: claude-haiku
  localization-lead: claude-haiku
  live-ops-designer: claude-sonnet

  # Specialists
  performance-analyst: claude-sonnet
  security-engineer: claude-sonnet
  devops-engineer: claude-haiku
  prototyper: gpt-4
  technical-director: claude-opus

  # (Add entries for the remaining 38 agents as needed)

# ── Per-Skill Overrides ─────────────────────────────────────────────────────
# Override the model used by specific skills.
# Supports 99 skills. List only the skills you want to pin to a specific model.
skills:
  brainstorm: claude-opus
  design-review: claude-sonnet
  code-review: claude-sonnet
  architecture-review: claude-opus
  consistency-check: claude-sonnet
  balance-check: gpt-4
  security-audit: claude-sonnet
  performance-profile: claude-sonnet        # Note: key is "perf-profile" in model config path
  bug-report: claude-haiku
  bug-triage: claude-haiku

# ── Batch Pattern Mapping ───────────────────────────────────────────────────
# Map model name globs to replacement models. This matches MODEL NAMES
# (not agent/skill names), useful for bulk migration.
# Example: any model containing "Kimi" → "claude-haiku"
batch:
  # "Kimi-*": "claude-haiku"
  # "deepseek-*": "gpt-4"
  # "*-fast": "claude-haiku"

# ── Global Default ──────────────────────────────────────────────────────────
# Fallback model when no agent/skill/batch override matches.
# Set null to use the tool's built-in default.
default: claude-sonnet

# ── Custom API Sources ──────────────────────────────────────────────────────
# Define named API endpoints for model routing. Each source can specify:
#   provider   — Model provider (anthropic, openai, google, custom)
#   baseUrl    — Custom endpoint URL (for proxies or self-hosted)
#   apiKey     — API key (or use \${ENV_VAR} for environment variables)
#   headers    — Additional HTTP headers
api:
  sources:
    # Example: Custom proxy for Anthropic
    # my-proxy:
    #   provider: anthropic
    #   baseUrl: https://my-proxy.example.com/v1
    #   headers:
    #     X-Custom-Header: value123
`;
/**
 * Write a commented template models.config.yaml to the target path.
 * Does NOT overwrite an existing file unless force=true.
 */
export function writeModelsConfigTemplate(projectPath, force) {
    const configPath = join(projectPath, 'models.config.yaml');
    if (existsSync(configPath) && !force) {
        return false;
    }
    writeFileSync(configPath, MODELS_TEMPLATE, 'utf-8');
    return true;
}
//# sourceMappingURL=models.js.map