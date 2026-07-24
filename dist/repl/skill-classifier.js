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
// ── Constants ──
/** 影响项目结构/方向的关键技能（需要人类决策） */
const IMPORTANT_SKILL_PATTERNS = [
    /^architecture-decision$/,
    /^gate-check$/,
    /^create-epics$/,
    /^create-stories$/,
    /^team-release$/,
    /^team-polish$/,
    /^create-architecture$/,
    /^milestone-review$/,
    /^retrospective$/,
    /^launch-checklist$/,
    /^release-checklist$/,
    /^propagate-design-change$/,
    /^day-one-patch$/,
];
/** 需要 Agent 委派的技能模式（LLM 动态匹配优于静态 agent 字段） */
const COMPLEX_SKILL_PATTERNS = [
    /^dev-story$/,
    /^code-review$/,
    /^security-audit$/,
    /^perf-profile$/,
    /^test-setup$/,
    /^regression-suite$/,
    /^soak-test$/,
    /^prototype$/,
    /^review-all-gdds$/,
    /^content-audit$/,
    /^localize$/,
    /^story-readiness$/,
    /^story-done$/,
    /^design-system$/,
    /^map-systems$/,
    /^brainstorm$/,
    /^estimate$/,
    /^vertical-slice$/,
];
/** 简单顺序执行的技能（无分支、无委派） */
const SIMPLE_SKILL_PATTERNS = [
    /^onboard$/,
    /^help$/,
    /^start$/,
    /^setup-engine$/,
    /^adopt$/,
    /^sprint-status$/,
    /^project-stage-detect$/,
    /^to-prd$/,
    /^ux-design$/,
    /^team-ui$/,
];
// ── Agent Matching ──
/** Agent 描述中的关键词权重表 */
const ROLE_KEYWORD_MAP = {
    // 设计方向
    design: ['game-designer', 'creative-director', 'systems-designer', 'level-designer', 'economy-designer', 'ux-designer'],
    narrative: ['narrative-director', 'writer', 'world-builder'],
    art: ['art-director', 'technical-artist'],
    audio: ['audio-director', 'sound-designer'],
    // 程序方向
    code: ['lead-programmer', 'ai-programmer', 'gameplay-programmer', 'engine-programmer', 'network-programmer', 'ui-programmer', 'tools-programmer'],
    review: ['code-reviewer', 'security-auditor', 'perf-auditor'],
    engine: ['unreal-specialist', 'unity-specialist', 'godot-specialist', 'cocos-specialist', 'build-specialist'],
    // QA 方向
    test: ['test-engineer', 'qa-lead', 'qa-tester'],
    qa: ['qa-lead', 'qa-tester', 'performance-analyst', 'security-engineer'],
    // 制作方向
    production: ['producer', 'technical-director', 'release-manager', 'devops-engineer'],
    release: ['release-manager', 'devops-engineer', 'producer'],
    // 运维方向
    analytics: ['analytics-engineer', 'live-ops-designer'],
    community: ['community-manager', 'localization-lead'],
    accessibility: ['accessibility-specialist'],
};
/**
 * 根据 skill 的描述和用户输入，匹配最合适的 agent(s)。
 */
export function matchSkillToAgents(skill, userArgs, availableAgents) {
    const combinedText = `${skill.description} ${skill.descriptionCn} ${skill.body} ${userArgs}`.toLowerCase();
    const agents = [];
    const reasons = [];
    // 1. 如果 skill 已有静态 agent 声明，优先使用
    if (skill.agent) {
        const staticAgent = availableAgents.find((a) => a.agentType === skill.agent || a.agentType.includes(skill.agent));
        if (staticAgent) {
            return {
                agents: [staticAgent],
                reasons: [`SKILL.md 静态声明 agent: ${skill.agent}`],
                createTeam: false,
            };
        }
    }
    // 2. 关键词权重匹配
    for (const agent of availableAgents) {
        let score = 0;
        const agentText = `${agent.agentType} ${agent.whenToUse}`.toLowerCase();
        // 检查 skill 描述中的关键词
        for (const [roleCategory, agentNames] of Object.entries(ROLE_KEYWORD_MAP)) {
            if (agentNames.includes(agent.agentType)) {
                // 检查 skill 是否涉及此领域
                const categoryKeywords = getCategoryKeywords(roleCategory);
                for (const kw of categoryKeywords) {
                    if (combinedText.includes(kw)) {
                        score += 3;
                    }
                }
            }
        }
        // agent 名称直接出现在 skill 中 → 高分
        if (combinedText.includes(agent.agentType.replace(/-/g, ' '))) {
            score += 10;
        }
        else if (combinedText.includes(agent.agentType)) {
            score += 8;
        }
        // agent 的 whenToUse 关键词与 skill 文本重叠
        const whenUseWords = agentText.split(/\s+/).filter((w) => w.length > 4);
        for (const word of whenUseWords) {
            if (combinedText.includes(word)) {
                score += 1;
            }
        }
        if (score > 0) {
            agents.push({ agent, score });
        }
    }
    // 3. 排序
    agents.sort((a, b) => b.score - a.score);
    // 4. 判定是否创建 team
    const topScore = agents[0]?.score ?? 0;
    const highMatches = agents.filter((a) => a.score >= topScore - 2 && a.score >= 5);
    if (highMatches.length >= 2) {
        // 检查是否来自不同域（互补性）
        const domains = new Set(highMatches.map((a) => {
            for (const [cat, names] of Object.entries(ROLE_KEYWORD_MAP)) {
                if (names.includes(a.agent.agentType))
                    return cat;
            }
            return 'unknown';
        }));
        const isComplementary = domains.size >= 2;
        reasons.push(`${highMatches.length} 个 agent 高度匹配 (scores: ${highMatches.map((h) => `${h.agent.agentType}=${h.score}`).join(', ')})` +
            (isComplementary ? '，跨域互补 → 创建 Team' : ''));
        return {
            agents: highMatches.map((h) => h.agent),
            reasons,
            createTeam: isComplementary,
        };
    }
    if (highMatches.length === 1) {
        return {
            agents: [highMatches[0].agent],
            reasons: [`最佳匹配: ${highMatches[0].agent.agentType} (score=${highMatches[0].score})`],
            createTeam: false,
        };
    }
    // 5. 无匹配 → 回退到通用 agent（game-designer 或 lead-programmer）
    const fallback = availableAgents.find((a) => a.agentType === 'game-designer') ??
        availableAgents.find((a) => a.agentType === 'lead-programmer') ??
        availableAgents[0];
    return {
        agents: fallback ? [fallback] : [],
        reasons: ['无特定匹配 → 回退到默认 agent'],
        createTeam: false,
    };
}
function getCategoryKeywords(category) {
    const map = {
        design: ['design', '设计', 'layout', 'balance', 'economy', 'ux', 'narrative', '故事', 'level', '关卡'],
        narrative: ['narrative', '故事', 'world', '世界', 'lore', 'dialogue', '对话'],
        art: ['art', '美术', 'visual', '视觉', 'shader', 'asset'],
        audio: ['audio', '音频', 'sound', '声音', 'music', '音乐'],
        code: ['code', '代码', 'program', '编程', 'implement', '实现', 'engine', '引擎', 'network', '网络'],
        review: ['review', '审查', 'audit', '审计', 'quality', '质量'],
        engine: ['engine', '引擎', 'build', '构建', 'pipeline', 'ci'],
        test: ['test', '测试', 'qa', '质量', 'bug', 'regression'],
        qa: ['qa', '质量', 'bug', '回归', '安全'],
        production: ['production', '制作', 'release', '发布', 'sprint', '冲刺', 'milestone', '里程碑'],
        release: ['release', '发布', 'deploy', '部署', 'ship'],
        analytics: ['analytics', '分析', 'data', '数据', 'live-ops', '运营'],
        community: ['community', '社区', 'localization', '本地化', 'translation', '翻译'],
        accessibility: ['accessibility', '无障碍', 'a11y'],
    };
    return map[category] ?? [];
}
// ── Classification Engine ──
/**
 * 对 skill 执行模式进行分类。
 *
 * 优先级：
 *   1. SKILL.md frontmatter 中显式声明 `complexity`
 *   2. 启发式规则匹配
 *   3. （future）LLM 判定
 */
export function classifySkill(skill, userArgs, availableAgents) {
    // ── 优先：显式声明 ──
    if (skill.complexity === 'simple' || skill.complexity === 'complex' || skill.complexity === 'important') {
        return buildExplicitResult(skill, skill.complexity, availableAgents, userArgs);
    }
    // ── 启发式判定 ──
    const skillName = skill.name.toLowerCase();
    // IMPORTANT: 影响项目结构/方向
    for (const pattern of IMPORTANT_SKILL_PATTERNS) {
        if (pattern.test(skillName)) {
            return {
                mode: 'important',
                source: 'heuristic',
                reason: `skill "${skill.name}" 影响项目架构/方向/里程碑决策`,
            };
        }
    }
    // COMPLEX: 需要 Agent 委派
    for (const pattern of COMPLEX_SKILL_PATTERNS) {
        if (pattern.test(skillName)) {
            const agentMatch = matchSkillToAgents(skill, userArgs, availableAgents);
            return {
                mode: 'complex',
                source: 'heuristic',
                reason: `skill "${skill.name}" 需要 Agent 判定和委派`,
                agentMatch,
            };
        }
    }
    // 如果 skill 静态声明了 agent → COMPLEX
    if (skill.agent) {
        const agentMatch = matchSkillToAgents(skill, userArgs, availableAgents);
        return {
            mode: 'complex',
            source: 'heuristic',
            reason: `skill "${skill.name}" 声明了静态 agent="${skill.agent}"`,
            agentMatch,
        };
    }
    // 检查 body 中是否有分支结构（if/then、when、choose 等）
    if (hasDecisionPoints(skill.body)) {
        const agentMatch = matchSkillToAgents(skill, userArgs, availableAgents);
        return {
            mode: 'complex',
            source: 'heuristic',
            reason: `skill "${skill.name}" body 包含决策分支`,
            agentMatch,
        };
    }
    // 检查 allowed-tools 是否包含 Agent → COMPLEX（需要委派子 Agent）
    if (skill.allowedTools?.some((t) => t.toLowerCase() === 'agent')) {
        const agentMatch = matchSkillToAgents(skill, userArgs, availableAgents);
        return {
            mode: 'complex',
            source: 'heuristic',
            reason: `skill "${skill.name}" 允许使用 Agent 工具（可委派子 Agent）`,
            agentMatch,
        };
    }
    // SIMPLE: 默认（无分支、无 agent 声明、无 Agent 工具）
    return {
        mode: 'simple',
        source: 'heuristic',
        reason: `skill "${skill.name}" 为顺序执行，无分支，无委派`,
    };
}
// ── Helpers ──
function buildExplicitResult(skill, mode, agents, userArgs) {
    const result = {
        mode,
        source: 'explicit',
        reason: `SKILL.md 显式声明 complexity="${mode}"`,
    };
    if (mode === 'complex') {
        result.agentMatch = matchSkillToAgents(skill, userArgs, agents);
    }
    return result;
}
/**
 * 检测 skill body 中是否包含决策分支。
 *
 * 模式：
 *   - if/then/else 结构
 *   - "Choose" / "Select" / "Pick" 指令
 *   - "Based on" / "Depending on" 条件
 *
 * 注意：必须检测真正的决策点，排除文档中的描述性 "if"（如 "if the role is ambiguous"）。
 */
function hasDecisionPoints(body) {
    // Strip code blocks and inline code to avoid false positives
    const stripped = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');
    // if/then 分支（排除文档描述性 if）
    const lines = stripped.split('\n');
    for (const line of lines) {
        // Match lines like "**IF** role is X: do Y" or "- **When** project: ..."
        if (/^\s*(?:\*\*|\-|\d+\.)\s*(?:if|when|else|otherwise)\b/i.test(line))
            return true;
        // Match inline decision "If X, then Y; else Z"
        if (/\bif\b.+\bthen\b/i.test(line) && line.trim().length < 200)
            return true;
    }
    // 选择类指令（明确的 "choose/select/pick/decide between/from"）
    if (/\b(choose|select|pick|decide)\s+(between|from|among|one of)\b/i.test(stripped))
        return true;
    // 条件路由短语
    if (/\b(based on|depending on|determine (whether|if))\b/i.test(stripped))
        return true;
    return false;
}
//# sourceMappingURL=skill-classifier.js.map