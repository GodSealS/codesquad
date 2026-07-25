/**
 * Tool registry — assembles tool pool, runs tool execution chain.
 *
 * References:
 *   Claude Code src/tools.ts — assembleToolPool()
 *   Claude Code src/tools/toolExecution.ts — runToolUse()
 *
 * Phase 1.7
 */
import { randomUUID } from 'crypto';
import { hasPermissionsToUseTool } from '../permissions/pipeline.js';
import { executePreToolHooks, executePostToolHooks, executePostToolUseFailureHooks } from '../hooks/executor.js';
import { ToolRegistry } from './ToolRegistry.js';
// ── Tool Pool ──
const legacyToolRegistry = new ToolRegistry();
export function registerTools(tools) {
    legacyToolRegistry.registerTools(tools);
}
export function registerTool(tool) {
    if (tool.name.startsWith('mcp__')) {
        legacyToolRegistry.mcpRegister(tool);
    }
    else {
        legacyToolRegistry.registerTool(tool);
    }
}
export function getToolPool(toolRegistry) {
    return toolRegistry?.getToolPool() ?? legacyToolRegistry.getToolPool();
}
export function findTool(name, toolRegistry) {
    return (toolRegistry ?? legacyToolRegistry).findTool(name);
}
export function clearToolPool() {
    legacyToolRegistry.clear();
}
/** Remove tools matching a name prefix (e.g. "mcp__" to clear MCP tools before re-registration). */
export function unregisterToolsByPrefix(prefix) {
    return legacyToolRegistry.unregisterByPrefix(prefix);
}
// ── Permission Rules ──
let _permissionRules = [];
export function setPermissionRules(rules) {
    _permissionRules = rules;
}
export function addPermissionRule(rule) {
    _permissionRules.push(rule);
}
export function clearPermissionRules() {
    _permissionRules = [];
}
/**
 * Complete tool execution chain:
 *   find → validateInput → PreToolUse hooks → permission pipeline → call → PostToolUse hooks
 *
 * Mirrors Claude Code's runToolUse() in toolExecution.ts.
 */
export async function runToolUse(options) {
    const { toolName, rawInput, context } = options;
    // Step 1: Find tool
    const tool = findTool(toolName, options.toolRegistry);
    if (!tool) {
        return {
            toolCallId: randomUUID(),
            output: null,
            content: `[Error] Unknown tool: "${toolName}". Available: ${getToolPool(options.toolRegistry).map(t => t.name).join(', ')}`,
            isError: true,
        };
    }
    // Step 2: Parse input with Zod schema
    const parsed = tool.inputSchema.safeParse(rawInput);
    if (!parsed.success) {
        const errors = parsed.error.issues.map(i => {
            const path = i.path.length > 0 ? i.path.join('.') : '(root)';
            return `  - ${path}: ${i.message}`;
        }).join('\n');
        return {
            toolCallId: randomUUID(),
            output: null,
            content: `[Input Error] Invalid ${toolName} arguments:\n${errors}`,
            isError: true,
        };
    }
    const input = parsed.data;
    // Step 3: Tool-specific validateInput
    const validation = tool.validateInput(input, context);
    if (!validation.valid) {
        return {
            toolCallId: randomUUID(),
            output: null,
            content: `[Validation Error] ${validation.message || 'Invalid input'}`,
            isError: true,
        };
    }
    // Step 4: Permission pipeline — check BEFORE hooks (security-first)
    const permission = hasPermissionsToUseTool(tool, input, context);
    if (permission.behavior === 'deny') {
        return {
            toolCallId: randomUUID(),
            output: null,
            content: `[Permission Denied] ${permission.message}`,
            isError: true,
        };
    }
    if (permission.behavior === 'ask' && context.headless) {
        return {
            toolCallId: randomUUID(),
            output: null,
            content: `[Permission Pending] ${permission.message || `${toolName} requires user approval.`}`,
            needsApproval: true,
        };
    }
    // Step 5: PreToolUse hooks (after permission check — safety-first)
    const preHookResult = await executePreToolHooks(toolName, {
        tool_name: toolName,
        tool_input: rawInput,
        command: rawInput.command,
        session_id: context.session.id,
    });
    if (preHookResult.decision === 'block') {
        return {
            toolCallId: randomUUID(),
            output: null,
            content: `[Hook Blocked] ${preHookResult.reason || `PreToolUse hook blocked ${toolName}`}`,
            isError: true,
        };
    }
    // Step 6: Check abort
    if (context.abortSignal.aborted) {
        return {
            toolCallId: randomUUID(),
            output: null,
            content: '[Cancelled] Operation was aborted.',
            isError: true,
        };
    }
    // Step 7: Execute
    const toolCallId = randomUUID();
    try {
        const result = await tool.call(input, context);
        result.toolCallId = toolCallId;
        // S03: enforce maxResultSizeChars — truncate tool results to prevent
        // a single tool result from consuming the entire context window.
        const maxSize = tool.maxResultSizeChars ?? 20_000;
        if (typeof result.content === 'string' && result.content.length > maxSize) {
            const originalLen = result.content.length;
            const truncated = result.content.slice(0, maxSize);
            result.content = truncated +
                `\n\n[... result truncated: ${originalLen} → ${maxSize} chars, ${originalLen - maxSize} chars omitted]`;
        }
        // Step 8: PostToolUse hooks
        await executePostToolHooks(toolName, {
            tool_name: toolName,
            tool_input: rawInput,
            session_id: context.session.id,
        });
        return result;
    }
    catch (err) {
        // PostToolUseFailure hooks
        await executePostToolUseFailureHooks(toolName, {
            tool_name: toolName,
            tool_input: rawInput,
        });
        return {
            toolCallId,
            output: null,
            content: `[Error] ${toolName}: ${err.message}`,
            isError: true,
        };
    }
}
// ── Tool Pool Assembly (Claude Code: assembleToolPool) ──
/**
 * Assemble the complete tool pool including MCP tools.
 * Mirrors Claude Code's `assembleToolPool()` in src/tools.ts.
 *
 * Merge order: built-in tools → MCP tools (from bridge) → dedup by name.
 */
export function assembleToolPool(context, toolRegistry) {
    // 1. Separate built-in from MCP tools
    const toolPool = getToolPool(toolRegistry);
    const builtins = toolPool.filter((t) => !t.name.startsWith('mcp__'));
    const mcps = toolPool.filter((t) => t.name.startsWith('mcp__'));
    // 2. Build dedup set: built-in tool names take priority
    const builtinNames = new Set(builtins.map((t) => t.name));
    // 3. Dedup MCP tools: if a built-in tool with the same base name exists, skip MCP version
    //    MCP tool names are in format: mcp__<server>__<tool>
    //    The "base name" is the tool name portion (after stripping server prefix)
    const dedupedMcps = mcps.filter((t) => {
        // Extract base name from mcp__<server>__<tool>
        const parts = t.name.split('__');
        if (parts.length >= 3) {
            const baseName = parts.slice(2).join('__');
            if (builtinNames.has(baseName)) {
                // Built-in tool with same name exists — skip MCP version
                return false;
            }
        }
        return true;
    });
    // 4. Merge: built-in first (alphabetical), MCP second (alphabetical)
    const pool = [
        ...builtins.sort((a, b) => a.name.localeCompare(b.name)),
        ...dedupedMcps.sort((a, b) => a.name.localeCompare(b.name)),
    ];
    if (!context)
        return pool;
    // 5. Filter: only tools enabled in this context
    return pool.filter((t) => {
        try {
            return t.isEnabled(context);
        }
        catch {
            return true;
        }
    });
}
/**
 * Get dedup statistics for display in startup logs.
 */
export function getDedupStats() {
    const toolPool = legacyToolRegistry.getToolPool();
    const builtins = toolPool.filter((t) => !t.name.startsWith('mcp__'));
    const mcps = toolPool.filter((t) => t.name.startsWith('mcp__'));
    const builtinNames = new Set(builtins.map((t) => t.name));
    let mcpDeduped = 0;
    for (const t of mcps) {
        const parts = t.name.split('__');
        if (parts.length >= 3) {
            const baseName = parts.slice(2).join('__');
            if (builtinNames.has(baseName))
                mcpDeduped++;
        }
    }
    return { builtin: builtins.length, mcp: mcps.length - mcpDeduped, mcpDeduped };
}
// ── Tool Prompt Assembly ──
/**
 * Generate tool descriptions for system prompt injection.
 * Only includes enabled tools.
 */
export function generateToolPrompts(context) {
    const pool = assembleToolPool(context);
    const enabled = pool.filter((t) => {
        if (!context)
            return true;
        try {
            return t.isEnabled(context);
        }
        catch {
            return true;
        }
    });
    if (enabled.length === 0)
        return '';
    const lines = ['## Available Tools', ''];
    for (const tool of enabled) {
        const mcpTag = tool.name.startsWith('mcp__') ? ' [MCP]' : '';
        lines.push(`### ${tool.name}${mcpTag}`);
        lines.push(tool.prompt());
        lines.push('');
    }
    return lines.join('\n');
}
// ── Tool Stats ──
export function getToolStats() {
    const toolPool = legacyToolRegistry.getToolPool();
    const total = toolPool.length;
    const readOnly = toolPool.filter((t) => t.isReadOnly()).length;
    const destructive = toolPool.filter((t) => t.isDestructive()).length;
    return { total, readOnly, destructive };
}
//# sourceMappingURL=registry.js.map