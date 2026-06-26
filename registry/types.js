/**
 * Registry types — two-layer registration system.
 *
 * Layers (priority: project > user):
 *   1. User-level  — AICore/agents/ skills/ rules/ hooks/ (built-in + external registrations)
 *   2. Project-level — <project>/.codesquad/agents/ skills/ rules/ hooks/ (project overrides)
 *
 * External CLIs register their agents/skills/rules/hooks into user-level (AICore/)
 * via `codesquad register` commands.
 */
/** Subdirectory name for each category. */
export const CATEGORY_DIRS = {
    agent: 'agents',
    skill: 'skills',
    rule: 'rules',
    hook: 'hooks',
};
/** File extension for each category. */
export const CATEGORY_EXT = {
    agent: '.md',
    skill: '', // Skills are directories with SKILL.md inside
    rule: '.md',
    hook: '.sh',
};
export function createEmptyManifest(aicorePath, aicoreVersion) {
    return {
        version: 1,
        aicore: { type: 'aicore', path: aicorePath, version: aicoreVersion, registeredAt: new Date().toISOString(), entryCount: 0 },
        externalSources: [],
        entries: [],
    };
}
//# sourceMappingURL=types.js.map