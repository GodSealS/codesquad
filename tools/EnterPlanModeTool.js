/**
 * EnterPlanModeTool — agent switches to plan mode to strategize before implementing.
 *
 * Agent calls this when it needs to think through architecture, design options,
 * or implementation plan before writing code. In plan mode, only read-only tools
 * are available.
 *
 * References:
 *   Claude Code src/tools/EnterPlanModeTool/
 *
 * Feature 5 — P5 Vibe Coding
 */
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { buildTool } from './types.js';
const InputSchema = z.object({
    reason: z.string().describe('Why planning is needed before implementing (what uncertainty needs resolution)'),
});
export const EnterPlanModeTool = buildTool({
    name: 'EnterPlanMode',
    description: 'Switch to plan mode to analyze and design before implementing.',
    searchHint: 'plan mode analyze design strategy',
    inputSchema: InputSchema,
    prompt() {
        return `Switches the agent into plan mode — a read-only mode for analysis and design.

In plan mode, only read-only tools (Read, Grep, Glob, WebSearch, WebFetch) are available.
No file modification is allowed.

Parameters:
- reason: Why you need planning (e.g. "Need to choose between REST and GraphQL", "Architecture design for new feature")

Use this when:
- Architecture decisions need to be made
- Multiple implementation approaches exist
- Refactoring scope needs assessment
- Dependency analysis is required

Exit plan mode by calling ExitPlanMode with a complete plan.`;
    },
    descriptionFor(input) {
        return `Enter plan mode: ${input.reason.slice(0, 60)}`;
    },
    isEnabled() { return true; },
    isReadOnly() { return true; },
    isConcurrencySafe() { return true; },
    isDestructive() { return false; },
    validateInput(input, _ctx) {
        if (!input.reason.trim())
            return { valid: false, message: 'Reason is required' };
        return { valid: true };
    },
    checkPermissions() { return { behavior: 'allow' }; },
    async call(input, _context) {
        const toolCallId = randomUUID();
        return {
            toolCallId,
            output: { mode: 'plan', reason: input.reason },
            content: `📐 Entering plan mode — ${input.reason}\n\n` +
                `In plan mode, you can only use read-only tools (Read, Grep, Glob, WebSearch, WebFetch).\n` +
                `Analyze the problem, explore the codebase, and design a solution.\n` +
                `When ready, call ExitPlanMode with your complete plan for user approval.`,
        };
    },
    maxResultSizeChars: 1000,
});
//# sourceMappingURL=EnterPlanModeTool.js.map