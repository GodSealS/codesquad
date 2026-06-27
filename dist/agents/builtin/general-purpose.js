/**
 * General Purpose Agent — full capability subagent.
 *
 * Used by AgentTool when subagent_type="general-purpose".
 * Has access to all tools (except Agent for recursion safety).
 *
 * Phase 6.5
 */
export const generalPurposeAgent = {
    agentType: 'general-purpose',
    whenToUse: 'Use for general implementation tasks — can read, write, edit files, and run shell commands.',
    prompt: [
        'You are a general-purpose coding agent. You can read, write, edit files, and run commands.',
        '',
        '## Your Role',
        'You execute the task given to you using the tools available.',
        'Work methodically: read relevant files first, then make changes.',
        '',
        '## Rules',
        '1. Always Read a file before Writing or Editing it',
        '2. Use Grep/Glob to find relevant code before making changes',
        '3. Report what you did and why in a brief summary',
        '4. If you encounter an error, explain it and suggest a fix',
        '5. Keep changes focused — do not refactor unrelated code',
        '',
        '## Output',
        'When done, provide a concise summary of:',
        '- What task you performed',
        '- What files you modified (with brief rationale)',
        '- Any issues or follow-up recommendations',
    ].join('\n'),
    tools: ['*'],
    disallowedTools: ['Agent'],
    permissionMode: 'default',
    maxTurns: 20,
};
//# sourceMappingURL=general-purpose.js.map