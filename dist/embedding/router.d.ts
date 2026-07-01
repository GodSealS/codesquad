/**
 * Agent/Skill 智能路由 — 语义匹配 + keywords + @mention
 *
 * 无显式 @mention 时，自动路由到最佳 agent/skill。
 * agent-coupled skill（user-invocable: false）被正确过滤。
 *
 * 路由优先级：
 *   Level 1: 显式 @mention → 直接使用
 *   Level 2: keywords 匹配 → 快速路径（build/test/engine）
 *   Level 3: 语义路由 → embedding 匹配（阈值从 settings 读取）
 *   Level 4: 默认 main agent
 *
 * 🔧 Fix B: features.agentRouting=false → 跳过语义路由
 * 🔧 R2-2: routingThreshold 从 settings 读取
 *
 * Step 9 / 18 执行步骤
 */
import type { EmbeddingProvider } from './types.js';
export interface RoutableTarget {
    name: string;
    displayName: string;
    description: string;
    embedding?: Float32Array;
    /** user-invocable: false → 不出现在路由结果 */
    userInvocable: boolean;
    /** 孤儿 skill（无对应 agent）→ WARNING */
    orphan: boolean;
    /** 歧义 skill（多个 agent 绑定）→ WARNING */
    ambiguous: boolean;
}
export interface RouteResult {
    target: RoutableTarget;
    method: 'mention' | 'keyword' | 'semantic' | 'default';
    score?: number;
}
/**
 * 注册可路由目标列表。
 * 在启动时由 agent/skill loader 调用。
 */
export declare function registerTargets(targets: RoutableTarget[]): void;
/**
 * 解析路由：根据 userInput 选择最佳 agent。
 *
 * @param userInput 用户原始输入
 * @param explicitMention 用户是否显式 @mention 了某个 agent
 * @returns 路由结果，或 null（使用默认 main agent）
 */
export declare function resolveAgent(userInput: string, explicitMention?: string): Promise<RouteResult | null>;
/**
 * 🚫 过滤规则：检查 target 是否应出现在路由结果中。
 */
export declare function isRoutable(target: RoutableTarget): boolean;
/**
 * 获取所有可路由目标（已过滤）。
 */
export declare function getRoutableTargets(): RoutableTarget[];
/**
 * 清除路由缓存（测试用）。
 */
export declare function resetRouter(): void;
/**
 * 为 target 预热 embedding（可选，在启动时调用以减少首次路由延迟）。
 */
export declare function warmupTargetEmbeddings(targets: RoutableTarget[], provider: EmbeddingProvider): Promise<void>;
/**
 * 🔧 Step 9 集成：从 .codesquad 文件系统初始化路由表。
 * 应在服务器/REPL 启动时调用一次。
 *
 * 流程：
 *   1. 扫描 .codesquad/agents/*.md → 提取 agent 名称+描述
 *   2. 扫描 .codesquad/skills/<name>/SKILL.md → 提取 skill 名称+描述+user-invocable
 *   3. buildAgentSkillBindingMap → 构建 UseSkill() 绑定映射
 *   4. 过滤 user-invocable:false skill，注册可路由目标
 *
 * @param aicoreDir .codesquad 目录的绝对路径
 * @param provider 可用的 EmbeddingProvider（用于预热）
 * @returns 注册的可路由目标数量
 */
export declare function initRouter(aicoreDir: string, provider?: EmbeddingProvider): Promise<number>;
/**
 * 🚫 Skill 绑定解析：通过扫描 .codesquad 文件系统推断 agent-coupled skill。
 *
 * 数据源：
 *   1. .codesquad/agents/*.md 中的 UseSkill("X") 引用
 *   2. .codesquad/skills/<name>/SKILL.md frontmatter 的 user-invocable: false
 *
 * 返回值：
 *   - agents: 绑定的 agent 名称列表
 *   - orphan: user-invocable=false 但无 UseSkill 引用
 *   - ambiguous: 被多个 agent 引用
 */
export declare function resolveSkillBinding(skillName: string, targets: RoutableTarget[], agentSkillMap?: Map<string, string[]>): Promise<{
    agents: string[];
    orphan: boolean;
    ambiguous: boolean;
}>;
/**
 * 🆕 从 .codesquad 文件系统构建 Agent ↔ Skill 绑定映射。
 * 扫描 agents/*.md 中的 UseSkill("X") 引用。
 *
 * @param aicoreDir .codesquad 目录的绝对路径
 * @returns Map<skillName, agentName[]>
 */
export declare function buildAgentSkillBindingMap(aicoreDir: string): Promise<Map<string, string[]>>;
//# sourceMappingURL=router.d.ts.map