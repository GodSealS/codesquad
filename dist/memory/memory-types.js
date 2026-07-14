/**
 * Memory Type System — defines 4 memory types and corresponding system prompt sections.
 *
 * References:
 *   Claude Code src/memdir/memoryTypes.ts
 *   Idea/tutrue/memory-system-design.md §2.3.1
 */
// ── Memory Types ──
/** 4 standard memory types (aligned with Claude Code). */
export const MEMORY_TYPES = ['user', 'feedback', 'project', 'reference'];
// ── System Prompt Sections ──
/** Individual mode: type taxonomy section injected into system prompt. */
export const TYPES_SECTION_INDIVIDUAL = `
## Memory Types

You have access to a memory system organized into 4 types:

1. **user** — Personal preferences, work style, and facts about the user.
   - Scope: Cross-project, follows the user.
   - Examples: "Prefers camelCase over snake_case", "Uses VS Code with Vim keybindings"

2. **feedback** — User feedback on your behavior and output.
   - Scope: Project-specific, feedback-driven improvements.
   - Examples: "User said test names should follow given_when_then pattern"

3. **project** — Project-specific conventions, architecture decisions, and team knowledge.
   - Scope: Shared with the team via version control.
   - Examples: "API base URL is https://api.example.com", "Use Zod for validation"

4. **reference** — External documentation, links, and factual references.
   - Scope: Project-specific.
   - Examples: "React 19 docs: https://react.dev", "Company style guide: link"

Only store information that CANNOT be derived from the current project state.
Do NOT store code snippets, file contents, or anything already in CLAUDE.md/CODEBUDDY.md.
`.trim();
/** Combined (team) mode type section. */
export const TYPES_SECTION_COMBINED = `
## Memory Types (Team Mode)

Same 4 types as individual mode, but use \`<scope>personal</scope>\` or \`<scope>team</scope>\` tags:

- Personal memories: visible only to you, stored in auto-memory/personal/
- Team memories: visible to all team members, stored in auto-memory/team/

<scope>personal</scope> or <scope>team</scope> must appear at the top of every memory file.
`.trim();
/** What NOT to save — prevents memory pollution. */
export const WHAT_NOT_TO_SAVE_SECTION = `
## What NOT to Save

Do NOT store:
- Code snippets or file contents (can be re-read from the project)
- Information already present in CLAUDE.md, CODEBUDDY.md, or .codesquad/rules/
- Git history, commit messages, or branch names (can be re-queried)
- Temporary build errors or transient issues
- Session-specific details that won't matter in future conversations
- Duplicates of existing memory entries

Save only insights that will remain true and useful across sessions.
`.trim();
/** When to access memory rules. */
export const WHEN_TO_ACCESS_SECTION = `
## When to Access Memory

Read relevant memories:
- At session start — check for user preferences and project context
- Before major decisions — verify no prior constraints or decisions exist
- When troubleshooting — check for known issues or workarounds
- Before creating new files — verify naming conventions and structure

Do NOT:
- Read memories for every trivial operation
- Assume stored memories are still accurate — verify against current project state
`.trim();
/** Trust-but-verify recall guidance. */
export const TRUSTING_RECALL_SECTION = `
## Trust but Verify

Memories are point-in-time observations. When recalling a memory:
1. Verify the referenced file/function/config still exists (use grep/read)
2. Check if the fact has been superseded by more recent project changes
3. If a memory contradicts current state, prefer current state and update the memory

Stale memories should be updated or removed, not blindly followed.
`.trim();
/** Frontmatter example for memory files. */
export const MEMORY_FRONTMATTER_EXAMPLE = `
## Memory File Format

Each memory file uses YAML frontmatter:

\`\`\`yaml
---
name: "API Design Preferences"
description: "Prefers RESTful APIs with kebab-case URLs"
type: user
tags: [api, design]
created: 2026-07-01
updated: 2026-07-05
---
Content starts here.
\`\`\`

Required fields: name, description, type.
Optional fields: tags, scope (for team mode), created, updated.
`.trim();
/** Memory drift caveat — warns about stale memories. */
export const MEMORY_DRIFT_CAVEAT = `
This memory is older than 1 day. Memories are point-in-time observations —
verify its accuracy against the current project state before relying on it.
`.trim();
/** Memory system capabilities — explains runtime memory features to the agent. */
export const MEMORY_SYSTEM_CAPABILITIES = `
## Memory System Capabilities

In addition to the memory types above, the system provides:

1. **Agent Memory** — Each agent may have a dedicated \`MEMORY.md\` file
   (scoped as user/project/local). This is injected automatically into
   your system prompt when present. Use it to persist agent-specific
   learnings across conversations.

2. **Memory Relevance** — Before each turn, the system scans \`.codesquad/memory/\`
   for files matching the current query context. The Top-5 most relevant
   memories are injected via \`<relevant_memories>\` blocks. Pay attention
   to staleness notes — older memories may be outdated.

3. **Session Memory** — Conversation summaries are auto-extracted into
   session-memory.md when token usage or tool-call thresholds are met.
   These summaries are used for context-aware conversation compaction,
   preserving key decisions and context even after message truncation.
`.trim();
//# sourceMappingURL=memory-types.js.map