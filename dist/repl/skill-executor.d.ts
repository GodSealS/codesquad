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
import { type ExecutionMode } from './skill-classifier.js';
import type { LoadedSkill } from './skill-registry.js';
import type { AgentDefinition } from '../agents/definition.js';
/** SIMPLE 模式执行回调 */
export type SimpleExecutor = (skill: LoadedSkill, args: string) => Promise<void>;
/** COMPLEX 模式执行回调：路由到指定 agent（可选创建 team） */
export type ComplexExecutor = (matchedAgent: string, teamAgents: string[] | null, skillName: string, args: string) => Promise<void>;
/** IMPORTANT 模式确认回调：返回 true 表示用户确认继续 */
export type ImportantConfirmer = (skillName: string, reason: string) => Promise<boolean>;
export interface SkillExecutionHooks {
    /** SIMPLE 模式：直接执行 */
    onSimple: SimpleExecutor;
    /** COMPLEX 模式：路由到 agent */
    onComplex?: ComplexExecutor;
    /** IMPORTANT 模式：请求用户确认 */
    onImportant?: ImportantConfirmer;
}
/**
 * 为 SIMPLE 模式准备 skill：
 *   只过滤掉 AskUserQuestion 工具，不修改 body。
 *   body 中的 SKILL.md 指令（如 "Do NOT ask"）本身就足够指导 LLM。
 *
 * 返回新的 skill 副本（不修改原始对象）。
 */
export declare function prepareSimpleSkill(skill: LoadedSkill): LoadedSkill;
/**
 * 统一的 skill 执行路由入口。
 *
 * @param skill      - 已加载的 skill
 * @param args       - 用户输入的参数
 * @param agents     - 可用 Agent 列表
 * @param hooks      - 平台相关执行回调
 * @param forceMode  - 强制模式覆盖（人类确认 IMPORTANT 后跳过分类）
 */
export declare function routeSkillExecution(skill: LoadedSkill, args: string, agents: AgentDefinition[], hooks: SkillExecutionHooks, forceMode?: ExecutionMode): Promise<void>;
//# sourceMappingURL=skill-executor.d.ts.map