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
import { loadSettings } from '../chat/settings.js';
import { isSemanticEnabled, getEmbeddingProvider } from './provider.js';
import { cosineSimilarity } from './store.js';
// ── 快速关键词映射 ──
const KEYWORD_ROUTES = [
    { keywords: ['build', 'compile', '编译', '构建'], target: 'build-engineer' },
    { keywords: ['test', 'jest', 'vitest', 'unittest', '单元测试', '测试'], target: 'qa-tester' },
    { keywords: ['引擎', 'engine', 'godot', 'unity', 'unreal', 'cocos'], target: 'engine-expert' },
    { keywords: ['deploy', '部署', 'publish', '发布'], target: 'devops-engineer' },
    { keywords: ['design', '设计', 'ui', 'ux', '界面'], target: 'ui-designer' },
    { keywords: ['review', 'code review', '审查', '代码审查'], target: 'code-reviewer' },
    { keywords: ['db', 'database', '数据库', 'sql'], target: 'data-engineer' },
    { keywords: ['security', '安全', '漏洞'], target: 'security-auditor' },
];
// ── 全局缓存 ──
let cachedTargets = null;
let targetEmbeddings = new Map();
// ── 公共 API ──
/**
 * 注册可路由目标列表。
 * 在启动时由 agent/skill loader 调用。
 */
export function registerTargets(targets) {
    cachedTargets = targets;
    targetEmbeddings.clear();
}
/**
 * 解析路由：根据 userInput 选择最佳 agent。
 *
 * @param userInput 用户原始输入
 * @param explicitMention 用户是否显式 @mention 了某个 agent
 * @returns 路由结果，或 null（使用默认 main agent）
 */
export async function resolveAgent(userInput, explicitMention) {
    // Level 1: 显式 @mention
    if (explicitMention) {
        const target = findTarget(explicitMention);
        if (target) {
            return { target, method: 'mention' };
        }
    }
    // 🔧 Fix B: features.agentRouting=false → 跳过语义路由
    if (!isSemanticEnabled())
        return null;
    const settings = loadSettings();
    if (!settings.semanticContext.features.agentRouting)
        return null;
    // Level 2: keywords 快速匹配
    const keywordMatch = matchKeywords(userInput);
    if (keywordMatch) {
        return keywordMatch;
    }
    // Level 3: 语义路由
    return semanticRoute(userInput, settings);
}
/**
 * 🚫 过滤规则：检查 target 是否应出现在路由结果中。
 */
export function isRoutable(target) {
    // user-invocable: false → 不出现在路由中
    if (!target.userInvocable)
        return false;
    // 孤儿 skill（无对应 agent）→ WARNING 但不出现在路由
    if (target.orphan) {
        console.warn(`[Router] orphan skill "${target.name}" — no binding agent, excluded from routing`);
        return false;
    }
    return true;
}
/**
 * 获取所有可路由目标（已过滤）。
 */
export function getRoutableTargets() {
    if (!cachedTargets)
        return [];
    return cachedTargets.filter(isRoutable);
}
/**
 * 清除路由缓存（测试用）。
 */
export function resetRouter() {
    cachedTargets = null;
    targetEmbeddings.clear();
}
// ── 内部实现 ──
function findTarget(name) {
    if (!cachedTargets)
        return null;
    const lower = name.toLowerCase();
    return cachedTargets.find(t => t.name.toLowerCase() === lower || t.displayName.toLowerCase() === lower) ?? null;
}
function matchKeywords(userInput) {
    const lower = userInput.toLowerCase();
    for (const route of KEYWORD_ROUTES) {
        for (const kw of route.keywords) {
            if (lower.includes(kw.toLowerCase())) {
                const target = findTarget(route.target);
                if (target && isRoutable(target)) {
                    return { target, method: 'keyword' };
                }
            }
        }
    }
    return null;
}
async function semanticRoute(userInput, settings) {
    const provider = await getEmbeddingProvider();
    if (!provider)
        return null;
    const targets = getRoutableTargets();
    if (targets.length === 0)
        return null;
    // 🔧 R2-2: routingThreshold 从 settings 读取
    const threshold = settings.semanticContext.routingThreshold;
    const inputEmb = await provider.embed(userInput);
    // 为每个 target 计算相似度
    const scored = await Promise.all(targets.map(async (target) => {
        let targetEmb = targetEmbeddings.get(target.name);
        if (!targetEmb) {
            // 用 target 的描述生成 embedding 并缓存
            const desc = `${target.displayName}: ${target.description}`;
            targetEmb = await provider.embed(desc);
            targetEmbeddings.set(target.name, targetEmb);
        }
        const score = cosineSimilarity(inputEmb, targetEmb);
        return { target, score };
    }));
    // 按相似度排序
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best || best.score < threshold)
        return null;
    return {
        target: best.target,
        method: 'semantic',
        score: best.score,
    };
}
/**
 * 为 target 预热 embedding（可选，在启动时调用以减少首次路由延迟）。
 */
export async function warmupTargetEmbeddings(targets, provider) {
    for (const target of targets) {
        if (!targetEmbeddings.has(target.name)) {
            const desc = `${target.displayName}: ${target.description}`;
            targetEmbeddings.set(target.name, await provider.embed(desc));
        }
    }
}
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
export async function initRouter(aicoreDir, provider) {
    const { readFileSync, readdirSync, existsSync } = await import('fs');
    const { join, basename } = await import('path');
    const targets = [];
    const bindingMap = await buildAgentSkillBindingMap(aicoreDir);
    const agentsDir = join(aicoreDir, 'agents');
    const skillsDir = join(aicoreDir, 'skills');
    // 1) 加载 agent
    if (existsSync(agentsDir)) {
        const agentFiles = readdirSync(agentsDir).filter(f => f.endsWith('.md'));
        for (const file of agentFiles) {
            const agentName = basename(file, '.md');
            try {
                const body = readFileSync(join(agentsDir, file), 'utf-8');
                const fm = parseSimpleFrontmatter(body);
                targets.push({
                    name: agentName,
                    displayName: fm.name ?? agentName,
                    description: fm.description ?? `Agent: ${agentName}`,
                    userInvocable: true,
                    orphan: false,
                    ambiguous: false,
                });
            }
            catch {
                // 跳过不可读文件
            }
        }
    }
    // 2) 加载 skill
    if (existsSync(skillsDir)) {
        const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
            .filter(d => d.isDirectory());
        for (const dir of skillDirs) {
            const skillMd = join(skillsDir, dir.name, 'SKILL.md');
            if (!existsSync(skillMd))
                continue;
            try {
                const body = readFileSync(skillMd, 'utf-8');
                const fm = parseSimpleFrontmatter(body);
                const skillName = fm.name ?? dir.name;
                const userInvocable = fm['user-invocable'] !== false;
                const bound = bindingMap.get(skillName);
                targets.push({
                    name: skillName,
                    displayName: fm.name ?? skillName,
                    description: fm.description ?? `Skill: ${skillName}`,
                    userInvocable,
                    orphan: !userInvocable && !bound,
                    ambiguous: !!(!userInvocable && bound && bound.length > 1),
                });
                if (!userInvocable) {
                    if (!bound) {
                        console.warn(`[Router] ⚠️ 孤儿 skill: ${skillName} (user-invocable:false 但无 UseSkill 引用)`);
                    }
                    else if (bound.length > 1) {
                        console.warn(`[Router] ⚠️ 歧义 skill: ${skillName} 被 ${bound.join(', ')} 多个 agent 引用`);
                    }
                }
            }
            catch {
                // 跳过不可读文件
            }
        }
    }
    // 3) 注册
    registerTargets(targets);
    // 4) 预热 embedding（可选）
    const routableTargets = targets.filter(isRoutable);
    if (provider && routableTargets.length > 0) {
        await warmupTargetEmbeddings(routableTargets, provider).catch(() => {
            console.warn('[Router] embedding 预热失败（非致命）');
        });
    }
    console.log(`[Router] 已注册 ${targets.length} 个路由目标 ` +
        `(${routableTargets.length} 可路由, ${targets.length - routableTargets.length} agent-coupled)`);
    return routableTargets.length;
}
/**
 * 解析简单的 YAML frontmatter（不依赖外部库）。
 * 格式：key: value（单行值）
 */
function parseSimpleFrontmatter(body) {
    const fm = {};
    const match = body.match(/^---\n([\s\S]*?)\n---/);
    if (!match)
        return fm;
    const lines = match[1].split('\n');
    for (const line of lines) {
        const m = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
        if (!m)
            continue;
        const key = m[1];
        const value = m[2].trim();
        if (value === 'true')
            fm[key] = true;
        else if (value === 'false')
            fm[key] = false;
        else
            fm[key] = value.replace(/^['"](.*)['"]$/, '$1');
    }
    return fm;
}
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
export async function resolveSkillBinding(skillName, targets, agentSkillMap) {
    // 🔧 Bug Fix #3: 优先使用传入的绑定映射（由文件系统扫描构建）
    if (agentSkillMap && agentSkillMap.has(skillName)) {
        const agents = agentSkillMap.get(skillName);
        return {
            agents,
            orphan: false,
            ambiguous: agents.length > 1,
        };
    }
    // 回退：名称模糊匹配（仅在没有绑定映射时使用）
    const boundAgents = targets
        .filter(t => {
        const tLower = t.name.toLowerCase();
        const sLower = skillName.toLowerCase();
        return tLower.includes(sLower) || sLower.includes(tLower);
    })
        .map(t => t.name);
    if (boundAgents.length === 0) {
        return { agents: [], orphan: true, ambiguous: false };
    }
    if (boundAgents.length > 1) {
        return { agents: boundAgents, orphan: false, ambiguous: true };
    }
    return { agents: boundAgents, orphan: false, ambiguous: false };
}
/**
 * 🆕 从 .codesquad 文件系统构建 Agent ↔ Skill 绑定映射。
 * 扫描 agents/*.md 中的 UseSkill("X") 引用。
 *
 * @param aicoreDir .codesquad 目录的绝对路径
 * @returns Map<skillName, agentName[]>
 */
export async function buildAgentSkillBindingMap(aicoreDir) {
    const map = new Map();
    const { readFileSync, readdirSync, existsSync } = await import('fs');
    const { join, basename } = await import('path');
    const agentsDir = join(aicoreDir, 'agents');
    if (!existsSync(agentsDir))
        return map;
    const agentFiles = readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    const useSkillRegex = /UseSkill\("([^"]+)"\)/g;
    for (const file of agentFiles) {
        const agentName = basename(file, '.md');
        const body = readFileSync(join(agentsDir, file), 'utf-8');
        let match;
        while ((match = useSkillRegex.exec(body)) !== null) {
            const skillName = match[1];
            const existing = map.get(skillName);
            if (existing) {
                existing.push(agentName);
            }
            else {
                map.set(skillName, [agentName]);
            }
        }
    }
    return map;
}
//# sourceMappingURL=router.js.map