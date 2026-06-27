/**
 * MCP Server — Skill Tools
 *
 * Implements:
 *   - skill.list    — list all skills with metadata
 *   - skill.schema  — get full interface contract for a specific skill
 *   - skill.invoke  — execute a skill (Phase 5, stub for now)
 */
import { loadSkillStubs, findSkillStub, filterByTag } from '../stub-loader.js';
function textResult(text, isError = false) {
    const content = { type: 'text', text };
    return { content: [content], isError };
}
/** Handle skill.list */
function handleSkillList(params) {
    let skills = loadSkillStubs();
    if (params?.filter && typeof params.filter === 'string') {
        skills = filterByTag(skills, params.filter);
    }
    const result = skills.map(s => ({
        name: s.name,
        description: s.description,
        tags: s.tags,
        user_invocable: s.userInvocable !== false,
        mcp_tool: s.mcp?.tool ?? 'skill.invoke',
    }));
    return textResult(JSON.stringify({
        count: result.length,
        skills: result,
    }, null, 2));
}
/** Handle skill.schema */
function handleSkillSchema(params) {
    if (!params || typeof params.name !== 'string') {
        return textResult(JSON.stringify({ error: 'Missing required parameter: name' }), true);
    }
    const stub = findSkillStub(params.name);
    if (!stub) {
        return textResult(JSON.stringify({ error: `Skill not found: ${params.name}` }), true);
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
        tags: stub.tags,
        user_invocable: stub.userInvocable !== false,
    }, null, 2));
}
/** Handle skill.invoke — full execution engine */
async function handleSkillInvoke(params) {
    if (!params || typeof params.name !== 'string') {
        return textResult(JSON.stringify({ error: 'Missing required parameter: name' }), true);
    }
    if (!params.model_config || typeof params.model_config !== 'object') {
        return textResult(JSON.stringify({ error: 'Missing required parameter: model_config (provider, api_key, model)' }), true);
    }
    try {
        const { runSkill } = await import('../executor/skill-runner.js');
        const result = await runSkill(process.cwd(), {
            name: params.name,
            arguments: params.arguments,
            context: params.context,
            model_config: params.model_config,
        });
        return textResult(JSON.stringify(result, null, 2), !result.success);
    }
    catch (err) {
        return textResult(JSON.stringify({
            error: 'skill.invoke failed',
            detail: err instanceof Error ? err.message : String(err),
        }), true);
    }
}
/** Tool name → handler mapping */
const SKILL_HANDLERS = {
    'skill.list': handleSkillList,
    'skill.schema': handleSkillSchema,
    'skill.invoke': handleSkillInvoke,
};
/** Route a skill tool call */
export async function handleSkillTool(toolName, params) {
    const handler = SKILL_HANDLERS[toolName];
    if (!handler)
        return null;
    return handler(params);
}
//# sourceMappingURL=skill-tools.js.map