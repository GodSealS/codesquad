/**
 * Skill Runner — Single-call LLM execution engine
 *
 * Skills execute in a single LLM call (no tool-call loop by default).
 * For skills that need multi-turn execution, maxTurns can be specified.
 *
 * Per D-05: Skill invocation uses independent LLM call (option a).
 * Per D-13: Default maxTurns = 5 for skills.
 */
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { LLMClient } from '../llm/client.js';
import { loadMcpConfig } from '../config.js';
import { McpErrorCode, mcpError } from '../errors.js';
import { executeTool } from './tool-registry.js';
import { sandboxSkillContext } from '../security/prompt-sandbox.js';
// ── Skill Loading ──
const CODEBUDDY_DIR = '.codebuddy';
/** Load skill prompt template from AICore/skills/{name}/SKILL.md */
function loadSkillPrompt(projectRoot, skillName) {
    const skillPath = join(projectRoot, CODEBUDDY_DIR, 'skills', skillName, 'SKILL.md');
    if (!existsSync(skillPath)) {
        throw mcpError(McpErrorCode.SKILL_NOT_FOUND, `Skill not found: ${skillName}. Path: ${skillPath}`);
    }
    const raw = readFileSync(skillPath, 'utf-8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
        return { prompt: raw, frontmatter: {} };
    }
    const frontmatterStr = match[1] ?? '';
    const body = match[2] ?? '';
    // Simple frontmatter parser
    const fm = {};
    for (const line of frontmatterStr.split('\n')) {
        const kvMatch = line.match(/^(\w[\w-]*):\s*(.+)$/);
        if (kvMatch) {
            const key = kvMatch[1] ?? '';
            let value = (kvMatch[2] ?? '').trim();
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1).split(',').map(s => s.trim());
            }
            fm[key] = value;
        }
    }
    return { prompt: body, frontmatter: fm };
}
// ── Execution ──
export async function runSkill(projectRoot, args) {
    const config = loadMcpConfig(projectRoot);
    const llmClient = new LLMClient(config, projectRoot);
    const workspaceRoot = resolve(args.context?.workspace_root ?? projectRoot);
    // 1. Load skill prompt
    const { prompt: skillPrompt, frontmatter } = loadSkillPrompt(projectRoot, args.name);
    // 2. Determine maxTurns (default 5 for skills per D-13)
    const maxTurns = typeof frontmatter.maxTurns === 'string'
        ? parseInt(frontmatter.maxTurns, 10) || 5
        : 5;
    // 3. Determine allowed tools
    const allowedToolsStr = frontmatter.allowedTools;
    const allowedTools = allowedToolsStr
        ? allowedToolsStr.split(',').map(t => t.trim())
        : ['Read', 'Glob', 'Grep'];
    // 4. Build messages
    const sandboxed = sandboxSkillContext({
        arguments: args.arguments ? JSON.stringify(args.arguments, null, 2) : undefined,
        gdd: args.context?.gdd,
        code: args.context?.code,
    });
    const contextStr = [sandboxed.gdd, sandboxed.code].filter(Boolean).join('\n\n');
    const systemPrompt = `${skillPrompt}\n\n## Context\n${contextStr}\n\n## Task\n${sandboxed.input ?? ''}`;
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: sandboxed.input || `Execute skill: ${args.name}` },
    ];
    // 5. Execute LLM call (single call, no tool loop by default)
    const response = await llmClient.call({ messages, max_tokens: config.budget.per_call_max_tokens }, args.model_config);
    const result = {
        success: true,
        output: response.content ?? '',
        usage: {
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            total_tokens: response.usage.total_tokens,
            cost_estimate: response.usage.cost_estimate ?? 0,
        },
    };
    // 6. If agentic (has tools and LLM requested tool calls), run tool loop
    if (response.tool_calls && response.tool_calls.length > 0 && maxTurns > 1) {
        // Push the initial assistant message with tool_calls before tool results
        messages.push({
            role: 'assistant',
            content: response.content ?? '',
            tool_calls: response.tool_calls,
        });
        // Execute the initial tool calls from the first response
        const toolDefs = (await import('./tool-definitions.js')).getToolDefs(allowedTools);
        for (const tc of response.tool_calls) {
            try {
                const toolResult = await executeTool(tc.name, tc.arguments, workspaceRoot, config.tools.bash.whitelist);
                messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: toolResult.success ? toolResult.output : `Error: ${toolResult.error}`,
                });
            }
            catch (err) {
                messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: `Error: ${String(err)}`,
                });
            }
        }
        // Accumulate usage from the first response
        result.usage = {
            prompt_tokens: result.usage.prompt_tokens + response.usage.prompt_tokens,
            completion_tokens: result.usage.completion_tokens + response.usage.completion_tokens,
            total_tokens: result.usage.total_tokens + response.usage.total_tokens,
            cost_estimate: (result.usage.cost_estimate ?? 0) + (response.usage.cost_estimate ?? 0),
        };
        let turn = 1;
        while (turn < maxTurns) {
            const resp = await llmClient.call({ messages, tools: toolDefs, max_tokens: config.budget.per_call_max_tokens }, args.model_config);
            result.usage = {
                prompt_tokens: result.usage.prompt_tokens + resp.usage.prompt_tokens,
                completion_tokens: result.usage.completion_tokens + resp.usage.completion_tokens,
                total_tokens: result.usage.total_tokens + resp.usage.total_tokens,
                cost_estimate: (result.usage.cost_estimate ?? 0) + (resp.usage.cost_estimate ?? 0),
            };
            if (!resp.tool_calls || resp.tool_calls.length === 0) {
                result.output = resp.content ?? '';
                break;
            }
            // Push assistant message before tool results
            messages.push({
                role: 'assistant',
                content: resp.content ?? '',
                tool_calls: resp.tool_calls,
            });
            for (const tc of resp.tool_calls) {
                try {
                    const toolResult = await executeTool(tc.name, tc.arguments, workspaceRoot, config.tools.bash.whitelist);
                    messages.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: toolResult.success ? toolResult.output : `Error: ${toolResult.error}`,
                    });
                }
                catch (err) {
                    messages.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: `Error: ${String(err)}`,
                    });
                }
            }
            turn++;
        }
    }
    return result;
}
//# sourceMappingURL=skill-runner.js.map