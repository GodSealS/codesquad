/**
 * AskUserQuestionTool — allow agents to ask the user clarifying questions.
 *
 * When information is insufficient, the agent can pause execution and ask
 * the user structured questions. This prevents guess-driven errors.
 *
 * References:
 *   Claude Code src/tools/AskUserQuestionTool/
 *
 * Feature 1 — P5 Vibe Coding
 */
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { buildTool } from './types.js';
// ── Input Schema ──
const InputSchema = z.object({
    questions: z.array(z.object({
        question: z.string().describe('The question to display to the user'),
        header: z.string().describe('Short display title for this question'),
        options: z.array(z.object({
            label: z.string().describe('Option label'),
            description: z.string().describe('What this option means'),
        })).describe('Available choices'),
        multiSelect: z.boolean().optional().default(false).describe('Allow selecting multiple options'),
    })).optional().describe('Questions to ask the user'),
    answers: z.record(z.string(), z.string()).optional().describe('User answers, keyed by question header (filled by system on re-invoke)'),
});
// ── Tool ──
export const AskUserQuestionTool = buildTool({
    name: 'AskUserQuestion',
    description: 'Ask the user clarifying questions when more information is needed. This is the ONLY way to ask questions — do NOT output questions as plain text.',
    searchHint: 'ask user question clarify',
    inputSchema: InputSchema,
    prompt() {
        return `**This is the ONLY way to ask the user questions. Do NOT output questions as plain text — the user will see a popup dialog only when you call this tool.**

Asks the user one or more clarifying questions when you don't have enough information to proceed.

Parameters:
- questions: Array of question objects, each with:
  - question: The full question text
  - header: Short title (used as answer key)
  - options: Array of {label, description} choices
  - multiSelect: Whether user can select multiple options (default false)
- answers: (System-filled) User's selected answers, keyed by header

**Use this tool whenever:**
- User requirements are ambiguous and you cannot proceed without clarification
- You need the user to choose between multiple valid approaches
- A technical or design decision needs explicit user input
- A skill/workflow says "use AskUserQuestion" — you MUST follow this instruction

After calling, the user's answers will be injected into the conversation.`;
    },
    descriptionFor(input) {
        return `Ask user: ${input.questions?.map((q) => q.header).join(', ') ?? ''}`;
    },
    isEnabled() { return true; },
    isReadOnly() { return true; },
    isConcurrencySafe() { return true; },
    isDestructive() { return false; },
    validateInput(input, _ctx) {
        // Re-invocation with answers — questions not required
        if (input.answers && Object.keys(input.answers).length > 0) {
            return { valid: true };
        }
        // First invocation — questions are required
        if (!input.questions || input.questions.length === 0) {
            return { valid: false, message: 'At least one question is required' };
        }
        for (const q of input.questions) {
            if (!q.question.trim())
                return { valid: false, message: 'Each question must have text' };
            if (!q.header.trim())
                return { valid: false, message: 'Each question must have a header' };
            if (!q.options || q.options.length < 2)
                return { valid: false, message: 'Each question must have at least 2 options' };
        }
        return { valid: true };
    },
    checkPermissions() { return { behavior: 'allow' }; },
    async call(input, context) {
        const toolCallId = randomUUID();
        const questions = input.questions ?? [];
        // If answers are already provided (second invocation), format them
        if (input.answers && Object.keys(input.answers).length > 0) {
            const answerLines = ['## User Answers', ''];
            for (const q of questions) {
                const answer = input.answers[q.header];
                if (answer) {
                    // Use the same separator as the frontend dialog (", ") to avoid
                    // leading spaces when splitting multi-select answers.
                    const selected = answer.split(', ').map((a) => a.trim()).filter(Boolean);
                    answerLines.push(`**${q.header}**: ${selected.join(', ')}`);
                }
            }
            return {
                toolCallId,
                output: input.answers,
                content: answerLines.join('\n'),
            };
        }
        // Guard: no questions and no answers → refuse
        if (questions.length === 0) {
            return {
                toolCallId,
                output: null,
                content: '[Error] AskUserQuestion called without questions. Ensure you pass at least one { question, header, options } object in the questions array.',
                isError: true,
            };
        }
        // First invocation: signal that we need user input
        // The caller (agent-runner / REPL) should detect this and pause
        context.__needsUserInput = {
            toolCallId,
            questions,
        };
        return {
            toolCallId,
            output: { questions },
            content: questions
                .map((q, i) => `**${i + 1}. ${q.header}**\n${q.question}\n` +
                q.options.map((o) => `  - ${o.label}: ${o.description}`).join('\n'))
                .join('\n\n'),
        };
    },
    maxResultSizeChars: 3000,
});
//# sourceMappingURL=AskUserQuestionTool.js.map