/**
 * MCP Server — Agent Tools
 *
 * Implements:
 *   - agent.list    — list all agents with metadata
 *   - agent.schema  — get full interface contract for a specific agent
 *   - agent.invoke  — execute an agent (Phase 4, stub for now)
 */
import { loadAgentStubs, findAgentStub, filterByTag } from '../stub-loader.js';
function textResult(text, isError = false) {
    const content = { type: 'text', text };
    return { content: [content], isError };
}
/** Handle agent.list */
function handleAgentList(params) {
    let agents = loadAgentStubs();
    if (params?.filter && typeof params.filter === 'string') {
        agents = filterByTag(agents, params.filter);
    }
    const result = agents.map(a => ({
        name: a.name,
        description: a.description,
        tags: a.tags,
        mode: a.mode,
        input: a.input ? Object.keys(a.input) : [],
        output: a.output ? Object.keys(a.output) : [],
        mcp_tool: a.mcp?.tool ?? 'agent.invoke',
    }));
    return textResult(JSON.stringify({
        count: result.length,
        agents: result,
    }, null, 2));
}
/** Handle agent.schema */
function handleAgentSchema(params) {
    if (!params || typeof params.name !== 'string') {
        return textResult(JSON.stringify({ error: 'Missing required parameter: name' }), true);
    }
    const stub = findAgentStub(params.name);
    if (!stub) {
        return textResult(JSON.stringify({ error: `Agent not found: ${params.name}` }), true);
    }
    return textResult(JSON.stringify({
        name: stub.name,
        description: stub.description,
        type: stub.type,
        mcp: stub.mcp,
        input: stub.input,
        output: stub.output,
        required_config: stub.requiredConfig,
        requires_context: stub.requiresContext,
        mode: stub.mode,
        tags: stub.tags,
    }, null, 2));
}
/** Handle agent.invoke — full execution engine */
async function handleAgentInvoke(params) {
    if (!params || typeof params.name !== 'string') {
        return textResult(JSON.stringify({ error: 'Missing required parameter: name' }), true);
    }
    if (!params.model_config || typeof params.model_config !== 'object') {
        return textResult(JSON.stringify({ error: 'Missing required parameter: model_config (provider, api_key, model)' }), true);
    }
    try {
        const { runAgent } = await import('../executor/agent-runner.js');
        const result = await runAgent(process.cwd(), {
            name: params.name,
            input: params.input,
            context: params.context,
            history: params.history,
            model_config: params.model_config,
            tools: params.tools,
        });
        return textResult(JSON.stringify(result, null, 2), !result.success);
    }
    catch (err) {
        return textResult(JSON.stringify({
            error: 'agent.invoke failed',
            detail: err instanceof Error ? err.message : String(err),
        }), true);
    }
}
/** Tool name → handler mapping */
const AGENT_HANDLERS = {
    'agent.list': handleAgentList,
    'agent.schema': handleAgentSchema,
    'agent.invoke': handleAgentInvoke,
};
/** Route an agent tool call */
export async function handleAgentTool(toolName, params) {
    const handler = AGENT_HANDLERS[toolName];
    if (!handler)
        return null;
    return handler(params);
}
//# sourceMappingURL=agent-tools.js.map