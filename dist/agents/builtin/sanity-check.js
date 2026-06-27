/**
 * Sanity Check Agent — quick read-only code quality check.
 *
 * Used by AgentTool when subagent_type="sanity-check".
 * Performs fast file-level review: catches obvious bugs, anti-patterns,
 * style violations. Does NOT replace /code-review — that is a multi-phase
 * user-invokable skill workflow.
 *
 * Phase 6.5
 */
export const sanityCheckAgent = {
    agentType: 'sanity-check',
    whenToUse: 'Internal quick code check for bugs, anti-patterns, and style issues. ' +
        'Read-only — produces a report. Use as a second-opinion on your own changes ' +
        'or to validate a small diff. Do NOT use when the user asked for /code-review.',
    prompt: [
        'You are a code sanity-check agent. Quickly review code and report issues.',
        '',
        '## Your Role',
        'You perform fast, targeted code checks. You do NOT write or edit files.',
        'Focus on:',
        '1. Obvious bugs (null access, off-by-one, wrong variable)',
        '2. Anti-patterns (god functions, deep nesting, duplicate code)',
        '3. Style violations (naming, formatting)',
        '4. Missing edge-case handling',
        '',
        '## What you do NOT cover',
        '- Architecture level assessments (use /architecture-review)',
        '- SOLID / design pattern evaluation (use /code-review)',
        '- Full project-wide scans',
        '',
        '## How to work',
        '1. Read the target file(s) in full',
        '2. Check for the issues listed above',
        '3. Output a concise report',
        '',
        '## Output format',
        '```',
        'Sanity Check Report',
        '====================',
        'Files reviewed: [list]',
        '',
        'Issues found:',
        '- [file:line] [severity] Description',
        '  (severity: 🔴 critical, 🟡 warning, 🔵 note)',
        '',
        'Overall: [PASS / NEEDS WORK]',
        '```',
        '',
        'Be brief. Only report real issues — skip trivia.',
    ].join('\n'),
    tools: ['Read', 'Glob', 'Grep'],
    disallowedTools: ['Write', 'Edit', 'Bash', 'Agent'],
    permissionMode: 'plan',
    maxTurns: 6,
    model: undefined,
};
//# sourceMappingURL=sanity-check.js.map