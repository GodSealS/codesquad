/**
 * ExitPlanModeTool — agent presents a complete plan and exits plan mode.
 *
 * After analyzing in plan mode, the agent creates a structured plan and
 * presents it to the user for approval. If approved, the agent returns
 * to its previous mode (ask/craft) and can begin implementation.
 *
 * References:
 *   Claude Code src/tools/ExitPlanModeV2Tool/
 *
 * Feature 5 — P5 Vibe Coding
 */
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { buildTool } from './types.js';
const InputSchema = z.object({
    plan: z.string().describe('The complete plan, including: approach, file changes, architecture decisions, risk assessment'),
});
export const ExitPlanModeTool = buildTool({
    name: 'ExitPlanMode',
    description: 'Present a complete plan and exit plan mode for user approval.',
    searchHint: 'exit plan mode present summary',
    inputSchema: InputSchema,
    prompt() {
        return `Exits plan mode and presents your complete analysis for user approval.

Parameters:
- plan: The complete plan (approach, file changes, architecture decisions, risks)

Your plan should include:
1. Problem summary
2. Proposed approach
3. Files to create/modify
4. Architecture decisions
5. Dependencies
6. Risk assessment

After this tool is called, the user will review the plan. If approved,
you can proceed to implement.`;
    },
    descriptionFor(input) {
        return `Exit plan mode → present plan`;
    },
    isEnabled() { return true; },
    isReadOnly() { return true; },
    isConcurrencySafe() { return true; },
    isDestructive() { return false; },
    validateInput(input, _ctx) {
        if (!input.plan.trim())
            return { valid: false, message: 'Plan content is required' };
        if (input.plan.length < 50)
            return { valid: false, message: 'Plan too short — provide detailed analysis' };
        return { valid: true };
    },
    checkPermissions() { return { behavior: 'allow' }; },
    async call(input, _context) {
        const toolCallId = randomUUID();
        return {
            toolCallId,
            output: { mode: 'exit_plan', planApproved: false },
            content: `📐 Plan presented:\n\n${input.plan.slice(0, 3000)}\n\n` +
                `---\n` +
                `User, please review this plan. Reply with:\n` +
                `- "approved" / "yes" to proceed with implementation\n` +
                `- Any feedback to refine the plan`,
        };
    },
    maxResultSizeChars: 4000,
});
//# sourceMappingURL=ExitPlanModeTool.js.map