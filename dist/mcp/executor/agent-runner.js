/**
 * Agent Runner — Tool-Call Loop Execution Engine
 *
 * Implements the full agentic execution cycle:
 * 1. Load agent prompt template from AICore/
 * 2. Inject context + input → build system prompt
 * 3. Enter tool-call loop (up to maxTurns)
 * 4. Call LLM API, execute tool calls, feed results back
 * 5. Return structured result
 *
 * Stateless: holds no API keys, session state, or context.
 */
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { LLMClient } from '../llm/client.js';
import { loadMcpConfig } from '../config.js';
import { getToolDefs } from './tool-definitions.js';
import { executeTool } from './tool-registry.js';
import { McpErrorCode, mcpError } from '../errors.js';
import { sandboxAgentContext } from '../security/prompt-sandbox.js';
import { startSpan, endSpan } from '../observability/tracer.js';
// ── Prompt Loading ──
const CODEBUDDY_DIR = '.codebuddy';
/** Load agent prompt template from AICore/agents/{name}.md */
function loadAgentPrompt(projectRoot, agentName) {
    const agentPath = join(projectRoot, CODEBUDDY_DIR, 'agents', `${agentName}.md`);
    if (!existsSync(agentPath)) {
        throw mcpError(McpErrorCode.AGENT_NOT_FOUND, `Agent not found: ${agentName}. Path: ${agentPath}`);
    }
    const raw = readFileSync(agentPath, 'utf-8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
        // No frontmatter — use entire file as prompt
        return { prompt: raw, frontmatter: {} };
    }
    const frontmatterStr = match[1] ?? '';
    const body = match[2] ?? '';
    // Parse frontmatter (simple key: value or key: [a, b, c])
    const fm = {};
    for (const line of frontmatterStr.split('\n')) {
        const kvMatch = line.match(/^(\w[\w-]*):\s*(.+)$/);
        if (kvMatch) {
            const key = kvMatch[1] ?? '';
            let value = (kvMatch[2] ?? '').trim();
            // Parse arrays: [a, b, c]
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value
                    .slice(1, -1)
                    .split(',')
                    .map(s => s.trim());
            }
            fm[key] = value;
        }
    }
    return { prompt: body, frontmatter: fm };
}
// ── Prompt Rendering ──
/** Render a prompt template with variable substitution */
function renderPrompt(template, vars) {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        // Replace {{KEY}} patterns
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
}
// ── Execution ──
export async function runAgent(projectRoot, args) {
    const span = startSpan('agent.invoke', 'server', undefined, {
        'agent.name': args.name,
        'provider': args.model_config.provider,
        'model': args.model_config.model,
    });
    const config = loadMcpConfig(projectRoot);
    const llmClient = new LLMClient(config, projectRoot);
    const workspaceRoot = resolve(args.context?.workspace_root ?? projectRoot);
    // 1. Load agent prompt template
    const { prompt: promptTemplate, frontmatter } = loadAgentPrompt(projectRoot, args.name);
    // 2. Determine allowed tools
    const agentToolsRaw = args.tools ?? (typeof frontmatter.tools === 'string'
        ? frontmatter.tools.split(',').map(t => t.trim())
        : []);
    const disallowedTools = typeof frontmatter.disallowedTools === 'string'
        ? frontmatter.disallowedTools.split(',').map(t => t.trim())
        : [];
    let allowedTools = agentToolsRaw.filter(t => !disallowedTools.includes(t));
    // Apply server-level constraints
    if (!config.tools.bash.enabled) {
        allowedTools = allowedTools.filter(t => t !== 'Bash');
    }
    // 3. Calculate maxTurns
    const maxTurns = typeof frontmatter.maxTurns === 'string'
        ? parseInt(frontmatter.maxTurns, 10) || 20
        : 20;
    // 4. Build system prompt
    const inputStr = args.input ? JSON.stringify(args.input, null, 2) : '';
    const sandboxed = sandboxAgentContext({
        gdd: args.context?.gdd,
        code: args.context?.code,
        references: args.context?.references,
        input: inputStr,
    });
    const contextStr = [sandboxed.gdd, sandboxed.code, sandboxed.references]
        .filter(Boolean)
        .join('\n\n');
    const systemPrompt = renderPrompt(promptTemplate, {
        CONTEXT: contextStr,
        INPUT: sandboxed.input ?? inputStr,
    });
    // 5. Build initial messages
    const messages = [
        { role: 'system', content: systemPrompt },
        ...(args.history ?? []).map(h => ({
            role: h.role,
            content: h.content,
            ...(h.role === 'tool' ? { tool_call_id: h.tool_call_id } : {}),
        })),
        { role: 'user', content: inputStr || 'Execute your task.' },
    ];
    // 6. Get tool definitions for LLM
    const toolDefs = getToolDefs(allowedTools);
    // 7. Tool-call loop
    let turn = 0;
    const allToolCalls = [];
    const writtenFiles = [];
    let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cost_estimate: 0 };
    let finalResult;
    try {
        while (turn < maxTurns) {
            // Context size check (soft limit)
            const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
            if (config.context && totalChars > config.context.soft_limit_tokens * 4) {
                finalResult = {
                    success: false,
                    output: { text: '', tool_calls: allToolCalls, files_written: writtenFiles },
                    usage: totalUsage,
                    turns_used: turn,
                    error: `CONTEXT_TOO_LARGE: context exceeds ${config.context.soft_limit_tokens} token soft limit`,
                };
                return finalResult;
            }
            let response;
            try {
                response = await llmClient.call({ messages, tools: toolDefs.length > 0 ? toolDefs : undefined, max_tokens: config.budget.per_call_max_tokens }, args.model_config);
            }
            catch (err) {
                const errObj = err;
                finalResult = {
                    success: false,
                    output: { text: '', tool_calls: allToolCalls, files_written: writtenFiles },
                    usage: totalUsage,
                    turns_used: turn,
                    error: `LLM_ERROR: ${errObj.message ?? String(err)}`,
                };
                return finalResult;
            }
            // Accumulate usage
            totalUsage = {
                prompt_tokens: totalUsage.prompt_tokens + response.usage.prompt_tokens,
                completion_tokens: totalUsage.completion_tokens + response.usage.completion_tokens,
                total_tokens: totalUsage.total_tokens + response.usage.total_tokens,
                cost_estimate: (totalUsage.cost_estimate ?? 0) + (response.usage.cost_estimate ?? 0),
            };
            // Budget check
            if ((totalUsage.cost_estimate ?? 0) > config.budget.per_call_cost_usd) {
                finalResult = {
                    success: false,
                    output: { text: '', tool_calls: allToolCalls, files_written: writtenFiles },
                    usage: totalUsage,
                    turns_used: turn,
                    error: `BUDGET_EXCEEDED: cost $${totalUsage.cost_estimate} exceeds limit $${config.budget.per_call_cost_usd}`,
                };
                return finalResult;
            }
            // No tool calls → agent completed
            if (!response.tool_calls || response.tool_calls.length === 0) {
                finalResult = {
                    success: true,
                    output: {
                        text: response.content ?? '',
                        files_written: writtenFiles,
                        tool_calls: allToolCalls,
                    },
                    usage: totalUsage,
                    turns_used: turn + 1,
                };
                return finalResult;
            }
            // Push assistant message (with tool_calls) before tool results
            // Both Anthropic and OpenAI APIs require the assistant message that
            // contains the tool_use/tool_calls to appear before the tool results.
            messages.push({
                role: 'assistant',
                content: response.content ?? '',
                tool_calls: response.tool_calls,
            });
            // Execute each tool call
            let hasBashAttempt = false;
            for (const tc of response.tool_calls) {
                // Check if tool is allowed
                if (disallowedTools.includes(tc.name)) {
                    allToolCalls.push({ name: tc.name, args: tc.arguments, result: { error: 'Tool forbidden' } });
                    messages.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: `Error: Tool '${tc.name}' is disallowed for this agent.`,
                    });
                    continue;
                }
                if (tc.name === 'Bash') {
                    if (!config.tools.bash.enabled) {
                        allToolCalls.push({ name: tc.name, args: tc.arguments, result: { error: 'Bash is disabled' } });
                        messages.push({
                            role: 'tool',
                            tool_call_id: tc.id,
                            content: 'Error: Bash is disabled. Use other tools.',
                        });
                        hasBashAttempt = true;
                        continue;
                    }
                }
                try {
                    const result = await executeTool(tc.name, tc.arguments, workspaceRoot, config.tools.bash.whitelist);
                    allToolCalls.push({ name: tc.name, args: tc.arguments, result });
                    if (tc.name === 'Write' && result.filePath) {
                        writtenFiles.push(result.filePath);
                    }
                    // Feed tool result back to LLM
                    messages.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: result.success ? result.output : `Error: ${result.error}`,
                    });
                }
                catch (err) {
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    allToolCalls.push({ name: tc.name, args: tc.arguments, result: { error: errorMsg } });
                    messages.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: `Error executing tool '${tc.name}': ${errorMsg}`,
                    });
                }
            }
            turn++;
            // If Bash was attempted but disabled, let LLM try again without Bash
            // (don't break the loop — the error message is already in tool result)
            if (hasBashAttempt) {
                // Continue loop so LLM can adjust and use other tools
            }
        }
        // Exceeded maxTurns
        finalResult = {
            success: false,
            output: { text: '', tool_calls: allToolCalls, files_written: writtenFiles },
            usage: totalUsage,
            turns_used: turn,
            error: `MAX_TURNS_EXCEEDED: agent ran ${turn} turns without completing`,
        };
        return finalResult;
    }
    finally {
        if (!finalResult) {
            finalResult = { success: false, output: { text: '' }, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cost_estimate: 0 }, turns_used: turn };
        }
        endSpan(span, finalResult.success ? undefined : finalResult.error);
    }
}
//# sourceMappingURL=agent-runner.js.map