/**
 * Model Resolver
 *
 * Resolves effective model names by applying models.config.yaml overrides.
 * Priority: per-agent/skill override > batch model-name pattern > original model > default
 *
 * ## Batch pattern matching
 *
 * The `batch` section of models.config.yaml maps **model name globs** to
 * replacement model identifiers — it does NOT match agent/skill names.
 * This allows bulk migration like:
 *
 * ```yaml
 * batch:
 *   "Deepseek-*": "claude-sonnet-4-20250514"
 *   "gpt-4o*": "gpt-4o-2026-05-20"
 * ```
 *
 * For per-agent/per-skill pinning, use the `agents:` / `skills:` sections.
 */
/**
 * Resolve the effective model for an agent or skill.
 *
 * Resolution order:
 * 1. Check per-agent/skill override (agents: or skills: in config, keyed by agent/skill name)
 * 2. Check batch model-name pattern (batch: in config, pattern matched against the
 *    agent/skill's **model** field, not its name; first match wins)
 * 3. Use config.default if set (falls through to original if null)
 * 4. Fall through to the original model field
 *
 * @param originalModel  The model name from the agent/skill definition frontmatter
 * @param name           The agent/skill name (used for per-item override lookup only)
 * @param type           'agent' or 'skill'
 * @param config         Optional models config overrides
 */
export function resolveModel(originalModel, name, type, config) {
    if (!config)
        return originalModel;
    // 1. Per-item override (indexed by agent/skill name)
    const overrides = type === 'agent' ? config.agents : config.skills;
    if (overrides && overrides[name] !== undefined) {
        const ov = overrides[name];
        return typeof ov === 'string' ? ov : ov.model;
    }
    // 2. Batch pattern match — patterns are globs against the model identifier,
    //    NOT the agent/skill name. E.g. pattern "Deepseek-*" matches model
    //    "Deepseek-V4-Flash" regardless of which agent uses it.
    if (config.batch) {
        for (const [pattern, replacement] of Object.entries(config.batch)) {
            if (matchModelGlob(pattern, originalModel)) {
                return replacement;
            }
        }
    }
    // 3. Default model
    if (config.default) {
        return config.default;
    }
    // 4. Fall through to original
    return originalModel;
}
/**
 * Simple glob-style pattern matching against **model identifiers** (case-insensitive).
 *
 * This matches patterns like "Deepseek-*" / "claude-*" against model name strings,
 * NOT against agent/skill names. For agent-name-based matching, use the per-item
 * `agents:` / `skills:` override sections.
 *
 * Supports:
 *   - * matches any sequence of non-special characters
 *   - literal text
 *   - case-insensitive: pattern "DeepSeek-*" matches "deepseek-v4-pro"
 */
function matchModelGlob(pattern, modelId) {
    // Convert glob pattern to regex: escape special chars, replace * with .*
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const regex = new RegExp(`^${escaped}$`, 'i');
    return regex.test(modelId);
}
//# sourceMappingURL=model-resolver.js.map