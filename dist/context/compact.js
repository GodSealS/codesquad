/**
 * Compact — LLM-powered conversation summarization.
 *
 * Replaces the v1 hard-truncation in budget.ts with intelligent LLM summarization.
 *
 * References:
 *   Claude Code src/services/compact/compact.ts (1706 lines)
 *
 * Algorithm (7 phases):
 *   1. Pre-check token count
 *   2. Execute PreCompact hooks
 *   3. Build compact prompt (9 chapter summary)
 *   4. Call LLM to generate summary
 *   5. Build compacted messages (boundary + summary + attachments)
 *   6. Execute PostCompact hooks
 *   7. Restore key files
 *
 * Phase 4.0
 */
import { estimateTokenCount } from '../chat/tokenizer.js';
import { executePreCompactHooks, executePostCompactHooks } from '../hooks/executor.js';
// ── Constants ──
const COMPACT_MAX_OUTPUT_TOKENS = 4096;
const POST_COMPACT_MAX_FILES_TO_RESTORE = 5;
const MIN_MESSAGES_TO_COMPACT = 10;
/** Number of most recent conversation messages to keep un-summarized after compaction. */
const KEEP_RECENT_MESSAGES = 5;
// ── Compact Prompt Template ──
const COMPACT_PROMPT_TEMPLATE = `## Context Compaction

You are summarizing a conversation to free up context window space.
Write a structured summary covering these 9 chapters:

1. **Primary Request**: What the user originally asked for.
2. **Key Technical Concepts**: Technologies, frameworks, patterns discussed.
3. **Files and Code Sections**: Files read, edited, or created — include paths.
4. **Errors and Fixes**: Errors encountered and how they were resolved.
5. **Problem Solving**: Problems solved during this conversation.
6. **All User Messages**: List every user message (compact form OK).
7. **Pending Tasks**: Tasks started but not completed.
8. **Current Work**: What was being worked on at the moment of compaction.
9. **Optional Next Step**: Suggested next action if the conversation continues.

Output format:
<analysis>Brief analysis of the conversation.</analysis>
<summary>The structured summary covering all 9 chapters above.</summary>

**CRITICAL**: Do NOT use any tools in this response. Output plain text only.
{extra_instructions}

The conversation to summarize follows below.`;
// ── Main Compaction Function ──
/**
 * Compact a conversation into a concise summary.
 *
 * @param messages  All conversation messages.
 * @param session   Current session for context.
 * @param options   Compaction options.
 * @param callLLM   LLM caller function (injected for testability).
 */
export async function compactConversation(messages, session, options, callLLM) {
    // Phase 1: Pre-check
    if (messages.length < MIN_MESSAGES_TO_COMPACT) {
        throw new Error(`Too few messages to compact (${messages.length} < ${MIN_MESSAGES_TO_COMPACT})`);
    }
    const preCompactTokenCount = estimateTokenCount(messages, options.model).total;
    // Phase 2: PreCompact hooks
    const hookResult = await executePreCompactHooks(options.customInstructions);
    const extraInstructions = hookResult.newCustomInstructions || '';
    // Phase 3: Build compact prompt
    const compactPrompt = COMPACT_PROMPT_TEMPLATE.replace('{extra_instructions}', extraInstructions ? `\nAdditional instructions: ${extraInstructions}` : '');
    // Collect conversation to summarize
    // Keep enough context for useful summarization (2000 chars per message vs old 500)
    const conversationText = messages
        .map((m) => `[${m.role}]: ${m.content.slice(0, 2000)}`)
        .join('\n');
    // Truncate safely: avoid splitting surrogate pairs
    let truncated = conversationText.slice(0, 100_000);
    if (truncated.length >= 100_000 && truncated.charCodeAt(truncated.length - 1) >= 0xD800 && truncated.charCodeAt(truncated.length - 1) <= 0xDBFF) {
        truncated = truncated.slice(0, -1); // Remove lone high surrogate
    }
    const fullPrompt = `${compactPrompt}\n\n## Conversation\n\n${truncated}`;
    // Phase 4: Call LLM for summary
    const summaryText = await callLLM({
        model: options.model,
        messages: [{ role: 'user', content: fullPrompt }],
        maxTokens: options.maxOutputTokens || COMPACT_MAX_OUTPUT_TOKENS,
    });
    // Phase 5: Build compacted messages
    const boundaryMessage = {
        role: 'system',
        content: `[Context Compacted] Conversation summarized at ${new Date().toISOString()}. ${messages.length} messages → summary.`,
        timestamp: new Date().toISOString(),
    };
    const summaryMessage = {
        role: 'user',
        content: `[Conversation Summary]\n${summaryText}`,
        timestamp: new Date().toISOString(),
        isContext: true,
    };
    // Keep the most recent messages intact so the LLM has immediate conversation context
    const keepMessages = messages.slice(-KEEP_RECENT_MESSAGES);
    // Estimate post-compact tokens
    const compactedMessages = [
        boundaryMessage,
        summaryMessage,
        ...keepMessages,
    ];
    const postCompactTokenCount = estimateTokenCount(compactedMessages, options.model).total;
    // Phase 6: PostCompact hooks
    await executePostCompactHooks();
    return {
        boundaryMessage,
        summaryMessage,
        preCompactTokenCount,
        postCompactTokenCount,
        compactedMessageCount: messages.length - keepMessages.length,
        customInstructions: extraInstructions || undefined,
    };
}
// ── Helper: Apply compact result to messages ──
/**
 * Replace old messages with compacted ones.
 * Keeps recent N messages + adds boundary + summary.
 */
export function applyCompaction(messages, result, keepRecent = 5) {
    const recent = messages.slice(-keepRecent);
    return [
        result.boundaryMessage,
        result.summaryMessage,
        ...recent,
    ];
}
//# sourceMappingURL=compact.js.map