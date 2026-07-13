/**
 * Memory age/staleness utilities.
 *
 * Injects freshness warnings when old memories are retrieved,
 * reminding LLMs that stored observations may be stale.
 *
 * References:
 *   Claude Code src/memdir/memoryAge.ts
 *   Idea/tutrue/memory-system-design.md §2.3.6
 */
const MS_PER_DAY = 86_400_000;
/** Calculate age of a memory in days. */
export function memoryAgeDays(mtimeMs) {
    return (Date.now() - mtimeMs) / MS_PER_DAY;
}
/** Human-readable age string (e.g., "today", "yesterday", "47 days ago"). */
export function memoryAge(mtimeMs) {
    const days = Math.round(memoryAgeDays(mtimeMs));
    if (days <= 0)
        return 'today';
    if (days === 1)
        return 'yesterday';
    return `${days} days ago`;
}
/** Returns staleness warning text when memory is older than 1 day. */
export function memoryFreshnessText(mtimeMs) {
    const days = Math.round(memoryAgeDays(mtimeMs));
    if (days <= 1)
        return '';
    return (`This memory is ${days} days old. Memories are point-in-time observations ` +
        `— verify its accuracy against the current project state before relying on it.`);
}
/** Wrap freshness warning in <system-reminder> tag for context injection. */
export function memoryFreshnessNote(mtimeMs) {
    const text = memoryFreshnessText(mtimeMs);
    if (!text)
        return '';
    return `<system-reminder>${text}</system-reminder>`;
}
//# sourceMappingURL=memory-age.js.map