/**
 * Agent execution runner — spawns a subagent with its own tool pool and context.
 *
 * References:
 *   Claude Code src/tools/AgentTool/runAgent.ts (35KB) — AsyncGenerator pattern
 *
 * Key design decisions (aligned with Claude Code):
 *   D1: Agent uses filtered tool pool (ALL_AGENT_DISALLOWED_TOOLS excluded)
 *   D2: Permission mode inheritance: parent bypassPermissions/acceptEdits cannot be overridden
 *   D3: Max turns from agent definition, capped at 20
 *   D4: SubagentStart/Stop hooks executed
 *
 * Phase 6.1
 */
import { runToolUse } from '../tools/registry.js';
import { executeSubagentStartHooks, executeSubagentStopHooks } from '../hooks/executor.js';
// ── Tool restriction for agents ──
/**
 * Tools that ALL agents (except main thread) are disallowed from using.
 * Aligns with Claude Code ALL_AGENT_DISALLOWED_TOOLS.
 */
const ALL_AGENT_DISALLOWED_TOOLS = new Set([
    'Agent', // Prevent infinite recursion
    'TodoWrite', // Agent doesn't manage its own todos (parent does)
]);
/**
 * Filter tools available to the subagent.
 *
 * Applies agent-specific tool restrictions from the definition:
 * 1. Start with the full environment tool pool
 * 2. Remove globally-disallowed tools (Agent, TodoWrite)
 * 3. If definition.tools is specified (not '*' and not undefined), keep only those
 * 4. Remove any tools listed in definition.disallowedTools
 */
function filterToolsForAgent(tools, definition) {
    let filtered = tools.filter((t) => !ALL_AGENT_DISALLOWED_TOOLS.has(t.name));
    // Apply agent's allowed-tools whitelist (if specified and not wildcard)
    if (definition.tools && definition.tools.length > 0 && !definition.tools.includes('*')) {
        const allowed = new Set(definition.tools);
        filtered = filtered.filter((t) => allowed.has(t.name));
    }
    // Apply agent's disallowed-tools blacklist
    if (definition.disallowedTools && definition.disallowedTools.length > 0) {
        const disallowed = new Set(definition.disallowedTools);
        filtered = filtered.filter((t) => !disallowed.has(t.name));
    }
    return filtered;
}
// ── Permission mode inheritance ──
/**
 * Resolve permission mode for subagent.
 * Parent's bypassPermissions/acceptEdits/plan cannot be overridden by agent.
 */
function resolveAgentPermissionMode(agentMode, parentMode) {
    // Parent's elevated modes cannot be downgraded
    if (parentMode === 'bypassPermissions' || parentMode === 'acceptEdits') {
        return parentMode;
    }
    // Plan mode propagates to subagent
    if (parentMode === 'plan') {
        return 'plan';
    }
    // Use agent's mode if specified, otherwise inherit parent
    return agentMode || parentMode;
}
// ── Main Runner ──
/**
 * Run a subagent with its own tool pool and execute the task.
 *
 * This is an AsyncGenerator — yields messages as they come in.
 * Caller collects results via for-await-of or by calling runAgentToCompletion().
 */
export async function* runAgentStream(options) {
    const { definition, task, parentSession, modelConfig, availableTools, parentPermissionMode, projectRoot, systemPromptSections, callLLM, runtimeConfig, abortSignal, } = options;
    const agentName = definition.agentType;
    // P0 fix: parent model (user's choice) takes priority over agent's own default.
    // SUBAGENT_MODEL_OVERRIDE is applied by AgentTool via modelConfig.model before calling runAgent.
    const model = modelConfig.model || definition.model || 'deepseek-v4-pro';
    const maxTurns = (definition.maxTurns ?? 20) > 0 ? (definition.maxTurns ?? 20) : 20;
    const permissionMode = resolveAgentPermissionMode(definition.permissionMode, parentPermissionMode);
    // ── SubagentStart hooks ──
    await executeSubagentStartHooks(agentName);
    // ── Filter tools ──
    const agentTools = filterToolsForAgent(availableTools, definition);
    // ── Build system prompt ──
    const systemMessages = [];
    // Agent's own prompt
    systemMessages.push({
        role: 'system',
        content: definition.prompt,
        timestamp: new Date().toISOString(),
    });
    // Extra sections (tool guidance, mode prompt, etc.)
    for (const section of systemPromptSections) {
        if (section) {
            systemMessages.push({
                role: 'system',
                content: section,
                timestamp: new Date().toISOString(),
            });
        }
    }
    // Tool guidance specific to agent's tools
    const toolGuidance = buildSubagentToolPrompt(agentTools);
    if (toolGuidance) {
        systemMessages.push({
            role: 'system',
            content: toolGuidance,
            timestamp: new Date().toISOString(),
        });
    }
    // ── Conversation messages (system separate from conversation) ──
    const conversationMessages = [
        {
            role: 'user',
            content: task,
            timestamp: new Date().toISOString(),
        },
    ];
    if (definition.initialPrompt) {
        conversationMessages.push({
            role: 'user',
            content: definition.initialPrompt,
            timestamp: new Date().toISOString(),
            isContext: true,
        });
    }
    // ── ToolUseContext for subagent ──
    const toolContext = {
        session: parentSession,
        cwd: projectRoot,
        projectRoot,
        abortSignal: abortSignal || new AbortController().signal,
        permissionMode,
        readFileState: { get: () => undefined, set: () => { }, has: () => false, clear: () => { } },
        headless: true,
    };
    // ── Execution loop ──
    let turn = 0;
    const assistantMessages = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    try {
        while (turn < maxTurns) {
            // Check abort
            if (abortSignal?.aborted) {
                yield {
                    role: 'system',
                    content: '[Subagent aborted]',
                    timestamp: new Date().toISOString(),
                };
                break;
            }
            // Call LLM — system first, then conversation
            const response = await callLLM(runtimeConfig, {
                model,
                messages: [
                    ...systemMessages.map((m) => ({ role: m.role, content: m.content })),
                    ...conversationMessages.map((m) => ({ role: m.role, content: m.content })),
                ],
                maxTokens: modelConfig.maxTokens ?? 4096,
                temperature: modelConfig.temperature ?? 0.7,
            });
            turn++;
            // Track usage
            if (response.usage) {
                totalPromptTokens += response.usage.promptTokens;
                totalCompletionTokens += response.usage.completionTokens;
            }
            // Extract tool calls
            const toolCalls = extractToolCallsForAgent(response.content, agentTools);
            // P0 fix: Detect empty tool calls (LLM returned nothing actionable).
            // Distinguish "task complete" (has content, no tools) from "empty attempt" (no content, no tools).
            const isEmptyToolAttempt = toolCalls.length === 0 && (!response.content || response.content.trim().length < 10);
            let _emptyToolCount = options.__emptyToolCount ?? 0;
            if (isEmptyToolAttempt) {
                _emptyToolCount++;
                options.__emptyToolCount = _emptyToolCount;
                if (_emptyToolCount >= 3) {
                    // Force termination with user-friendly message
                    const forceMsg = {
                        role: 'assistant',
                        content: '连续 3 轮未产生有效工具调用，子 Agent 已终止。',
                        timestamp: new Date().toISOString(),
                    };
                    conversationMessages.push(forceMsg);
                    assistantMessages.push(forceMsg);
                    break;
                }
                // Inject hint on first empty call
                if (_emptyToolCount === 1) {
                    conversationMessages.push({
                        role: 'user',
                        content: '[System] 上一轮未产生有效工具调用。如果需要执行操作，请使用工具；如果任务已完成，请给出最终回复。',
                        timestamp: new Date().toISOString(),
                    });
                }
                continue; // Give LLM another chance
            }
            // Reset counter when valid content/tools are produced
            if (_emptyToolCount > 0)
                options.__emptyToolCount = 0;
            if (toolCalls.length > 0) {
                // Add assistant message
                const assistantMsg = {
                    role: 'assistant',
                    content: response.content,
                    timestamp: new Date().toISOString(),
                };
                conversationMessages.push(assistantMsg);
                assistantMessages.push(assistantMsg);
                // Execute tools
                for (const tc of toolCalls) {
                    const result = await runToolUse({
                        toolName: tc.name,
                        rawInput: tc.input,
                        context: toolContext,
                    });
                    conversationMessages.push({
                        role: 'user',
                        content: `[Tool: ${tc.name}]\n${result.content}`,
                        timestamp: new Date().toISOString(),
                    });
                }
                continue; // Next turn
            }
            // No tool calls — subagent is done
            const finalMsg = {
                role: 'assistant',
                content: response.content,
                timestamp: new Date().toISOString(),
            };
            conversationMessages.push(finalMsg);
            assistantMessages.push(finalMsg);
            break;
        }
        // ── Build result ──
        const truncated = turn >= maxTurns;
        const summary = buildSubagentSummary(agentName, task, assistantMessages, turn, truncated);
        // ── SubagentStop hooks ──
        await executeSubagentStopHooks(agentName);
        const result = {
            messages: assistantMessages,
            summary,
            turns: turn,
            truncated,
            usage: { promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens },
        };
        return result;
    }
    catch (err) {
        await executeSubagentStopHooks(agentName);
        throw err;
    }
    finally {
        // P1 fix: Clean up instance manager regardless of success/failure.
        // Prevents orphan instances and close errors.
        try {
            const { getAgentInstanceManager } = await import('./instance-manager.js');
            const mgr = getAgentInstanceManager();
            if (mgr) {
                // Find instance by agent name and cancel if still active
                const instances = mgr.list('running');
                for (const inst of instances) {
                    if (inst.agentType === agentName && inst.status === 'running') {
                        mgr.unregister(inst.id);
                    }
                }
            }
        }
        catch {
            // Dynamic import failure in finally should not shadow the original error
        }
    }
}
// ── Convenience: run to completion ──
/**
 * Run a subagent and return the collected result.
 * Convenience wrapper around runAgentStream.
 */
export async function runAgent(options) {
    const gen = runAgentStream(options);
    let result;
    let done = false;
    while (!done) {
        const next = await gen.next();
        done = next.done ?? false;
        if (done && next.value) {
            result = next.value;
        }
    }
    if (!result) {
        throw new Error('Agent runner did not return a result');
    }
    return result;
}
// ── Helpers ──
function extractToolCallsForAgent(content, agentTools) {
    const results = [];
    // Pattern 1a: <tool-call name="ToolName">{"key":"value"}</tool-call>
    const toolPattern = /<tool-call\s+name="([^"]+)"\s*>([\s\S]*?)<\/tool-call>/gi;
    let match;
    while ((match = toolPattern.exec(content)) !== null) {
        try {
            const name = match[1];
            const jsonStr = match[2].trim();
            const input = jsonStr ? JSON.parse(jsonStr) : {};
            results.push({ name, input });
        }
        catch { /* skip malformed JSON */ }
    }
    // Pattern 1b: <tool-call name="ToolName" /> (self-closing)
    const selfClosingPattern = /<tool-call\s+name="([^"]+)"\s*\/>/gi;
    while ((match = selfClosingPattern.exec(content)) !== null) {
        results.push({ name: match[1], input: {} });
    }
    // Pattern 2: JSON block with tool_calls array
    if (results.length === 0) {
        const jsonBlock = content.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);
        if (jsonBlock) {
            try {
                const parsed = JSON.parse(jsonBlock[0]);
                if (Array.isArray(parsed.tool_calls)) {
                    for (const tc of parsed.tool_calls) {
                        const name = tc.function?.name || tc.name;
                        const input = tc.function?.arguments
                            ? (typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments)
                            : (tc.input || {});
                        if (name)
                            results.push({ name, input: input || {} });
                    }
                }
            }
            catch { /* skip */ }
        }
    }
    // Filter to agent's allowed tools only
    const agentToolNames = new Set(agentTools.map((t) => t.name));
    return results.filter((tc) => agentToolNames.has(tc.name));
}
function buildSubagentToolPrompt(tools) {
    if (tools.length === 0)
        return '';
    const lines = ['## Available Tools (Subagent)', ''];
    for (const tool of tools) {
        lines.push(`### ${tool.name}`);
        lines.push(tool.prompt());
        lines.push('');
    }
    return lines.join('\n');
}
function buildSubagentSummary(agentName, task, messages, turns, truncated) {
    const lastResponse = messages[messages.length - 1]?.content || '(no response)';
    const condensed = lastResponse.slice(0, 2000);
    return [
        `**Subagent: ${agentName}**`,
        `Turns: ${turns}${truncated ? ' (truncated)' : ''}`,
        '',
        `> Task: ${task.slice(0, 300)}`,
        '',
        '---',
        '',
        condensed,
        truncated && condensed.length >= 2000 ? '\n\n... (truncated)' : '',
    ].join('\n');
}
//# sourceMappingURL=runner.js.map