/**
 * Skill Execution Router — 共享的 skill 执行路由层。
 *
 * 所有执行路径（REPL CLI / Web 流式 / Web 非流式）共享同一份：
 *   1. 分类判定（simple / complex / important）
 *   2. 工具过滤（SIMPLE 模式排除 AskUserQuestion）
 *   3. 执行指令注入（SIMPLE 模式注入自主执行指令）
 *
 * 各路径通过 hooks 提供平台相关的执行方式：
 *   - REPL: SkillInstance.create() / startOrContinueAgent() / y/n 终端提示
 *   - Web:  runAgent() / SSE 事件 / JSON 响应
 */
import { classifySkill, matchSkillToAgents } from './skill-classifier.js';
// ── Shared Preparation ──
/**
 * 为 SIMPLE 模式准备 skill：
 *   只过滤掉 AskUserQuestion 工具，不修改 body。
 *   body 中的 SKILL.md 指令（如 "Do NOT ask"）本身就足够指导 LLM。
 *
 * 返回新的 skill 副本（不修改原始对象）。
 */
export function prepareSimpleSkill(skill) {
    const prepared = { ...skill };
    // Filter AskUserQuestion from allowed tools
    if (prepared.allowedTools?.length) {
        prepared.allowedTools = prepared.allowedTools.filter((t) => t.toLowerCase() !== 'askuserquestion');
    }
    return prepared;
}
// ── Shared Router ──
/**
 * 统一的 skill 执行路由入口。
 *
 * @param skill      - 已加载的 skill
 * @param args       - 用户输入的参数
 * @param agents     - 可用 Agent 列表
 * @param hooks      - 平台相关执行回调
 * @param forceMode  - 强制模式覆盖（人类确认 IMPORTANT 后跳过分类）
 */
export async function routeSkillExecution(skill, args, agents, hooks, forceMode) {
    // ── 1. 分类 ──
    const classification = forceMode
        ? { mode: forceMode, source: 'explicit', reason: `forceMode=${forceMode} (人类确认后重入)` }
        : classifySkill(skill, args, agents);
    // ── 2. IMPORTANT: 请求用户确认 ──
    if (classification.mode === 'important' && hooks.onImportant) {
        const confirmed = await hooks.onImportant(skill.name, classification.reason);
        if (confirmed) {
            // 用户确认 → 以 SIMPLE 模式重新执行
            await routeSkillExecution(skill, args, agents, hooks, 'simple');
        }
        return;
    }
    // ── 3. COMPLEX: 路由到 Agent ──
    if (classification.mode === 'complex' && hooks.onComplex) {
        const agentMatch = classification.agentMatch ?? matchSkillToAgents(skill, args, agents);
        if (agentMatch.agents.length > 0) {
            const matchedAgent = agentMatch.agents[0].agentType;
            const teamAgents = agentMatch.createTeam
                ? agentMatch.agents.map((a) => a.agentType)
                : null;
            await hooks.onComplex(matchedAgent, teamAgents, skill.name, args);
        }
        else {
            // Fallback: no matching agent → execute as SIMPLE
            await hooks.onSimple(prepareSimpleSkill(skill), args);
        }
        return;
    }
    // ── 4. SIMPLE: 直接执行 ──
    await hooks.onSimple(prepareSimpleSkill(skill), args);
}
//# sourceMappingURL=skill-executor.js.map