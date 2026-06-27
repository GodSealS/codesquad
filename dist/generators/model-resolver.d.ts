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
import type { ModelsConfig } from '../adapters/types.js';
export interface ResolvedModel {
    original: string;
    resolved: string;
    matchedRule?: string;
}
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
export declare function resolveModel(originalModel: string, name: string, type: 'agent' | 'skill', config?: ModelsConfig): string;
//# sourceMappingURL=model-resolver.d.ts.map