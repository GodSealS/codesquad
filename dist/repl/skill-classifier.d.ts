/**
 * Skill Execution Classifier — 在 skill 执行前判定执行模式。
 *
 * 三级分类（用户定义的设计原则）：
 *   SIMPLE   — 顺序执行，无分支，不委派，不弹窗
 *   COMPLEX  — 需要决策/分支，AI 自动匹配 Agent（可能创建 Team）
 *   IMPORTANT — 影响项目结构/方向，必须弹窗由人类决策
 *
 * 判定来源优先级：
 *   1. SKILL.md frontmatter 显式声明 `complexity`（最高优先）
 *   2. 代码规则推断（heuristic）
 *   3. LLM 判定的兜底（future: 对模糊 case 调用小模型裁决）
 */
import type { LoadedSkill } from './skill-registry.js';
import type { AgentDefinition } from '../agents/definition.js';
/** 执行模式 */
export type ExecutionMode = 'simple' | 'complex' | 'important';
/** Agent 匹配结果 */
export interface AgentMatchResult {
    /** 匹配到的 agent 列表（按匹配度降序） */
    agents: AgentDefinition[];
    /** 匹配理由（用于日志/调试） */
    reasons: string[];
    /** 是否应该创建 team（≥2 个 agent 高度匹配且互补） */
    createTeam: boolean;
}
/** 分类结果 */
export interface ClassificationResult {
    mode: ExecutionMode;
    /** 判定来源 */
    source: 'explicit' | 'heuristic' | 'llm';
    /** 判定理由 */
    reason: string;
    /** COMPLEX 模式下的 agent 匹配结果 */
    agentMatch?: AgentMatchResult;
}
/**
 * 根据 skill 的描述和用户输入，匹配最合适的 agent(s)。
 */
export declare function matchSkillToAgents(skill: LoadedSkill, userArgs: string, availableAgents: AgentDefinition[]): AgentMatchResult;
/**
 * 对 skill 执行模式进行分类。
 *
 * 优先级：
 *   1. SKILL.md frontmatter 中显式声明 `complexity`
 *   2. 启发式规则匹配
 *   3. （future）LLM 判定
 */
export declare function classifySkill(skill: LoadedSkill, userArgs: string, availableAgents: AgentDefinition[]): ClassificationResult;
//# sourceMappingURL=skill-classifier.d.ts.map