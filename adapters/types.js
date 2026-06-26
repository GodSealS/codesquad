/**
 * CodeSquad Core Types
 *
 * Tool-agnostic definitions for Agent and Skill content.
 * These types represent the canonical format stored in the CLI package.
 * Adapters translate these into tool-specific frontmatter and paths.
 */
/** Build a partial ModelsConfig with batch mappings and an optional default model */
export function buildDefaultModels(batch = {}, defaultModel = null) {
    return {
        batch,
        agents: {},
        skills: {},
        default: defaultModel,
    };
}
//# sourceMappingURL=types.js.map