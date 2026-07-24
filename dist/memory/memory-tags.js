/**
 * Memory Tag System — domain classification + context-aware tag matching.
 *
 * Design principle: memories are classified by domain tags. Current conversation
 * context determines which tags are relevant, and only compressed summaries
 * of matching memories are injected. Full content is retrieved on-demand.
 *
 * Tag taxonomy is loaded from Config/memory-tags.yaml (runtime-editable).
 * A built-in fallback is used if the config file is missing.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { virtualExists, virtualReadFile } from '../embedded/virtual-fs.js';
// ── Built-in Fallback ──
const BUILTIN_TAGS = {
    version: 1,
    tags: {
        programming: { name: '编程', keywords: ['代码', '编程', '程序', '实现', '逻辑', '重构', 'debug', 'bug', '算法', 'API', '接口', '模块'] },
        architecture: { name: '架构', keywords: ['架构', '设计模式', '模块设计', '系统设计', '分层', '依赖', '解耦', 'ECS', 'MVC'] },
        codingStandard: { name: '编码规范', keywords: ['命名', '规范', 'convention', 'style', 'lint', '格式化', '注释'] },
        networking: { name: '服务器', keywords: ['服务器', '网络', '后端', 'server', 'API', 'HTTP', 'REST', '数据库', '同步', '多人', 'multiplayer'] },
        performance: { name: '性能优化', keywords: ['性能', '优化', '帧率', 'FPS', '内存', 'memory', 'profile', 'drawcall', 'batch', 'LOD', 'culling'] },
        design: { name: '设计', keywords: ['设计', '玩法', '机制', '系统设计', '关卡', '数值', '平衡', 'gameplay', 'mechanic'] },
        levelDesign: { name: '关卡设计', keywords: ['关卡', 'level', '地图', '场景', '布局', 'platforming', 'puzzle'] },
        economy: { name: '经济系统', keywords: ['经济', '货币', 'economy', '金币', '商店', '交易'] },
        narrative: { name: '叙事', keywords: ['叙事', '剧情', '故事', '对话', '世界观', 'lore', 'quest', '任务', '角色', 'character'] },
        art: { name: '美术', keywords: ['美术', '模型', '贴图', '纹理', '材质', 'shader', '渲染', '动画', '骨骼', 'sprite', '2D', '3D'] },
        vfx: { name: '特效', keywords: ['特效', '粒子', 'particle', 'VFX', '爆炸', 'trail'] },
        uiux: { name: 'UI/UX', keywords: ['UI', 'UX', '界面', '交互', '按钮', '菜单', 'HUD', 'widget'] },
        audio: { name: '音频', keywords: ['音频', '音效', '音乐', 'sound', 'music', 'BGM', 'SFX', '混音'] },
        unity: { name: 'Unity', keywords: ['Unity', 'unity', 'C#', 'MonoBehaviour', 'GameObject', 'Prefab', 'AssetBundle'] },
        godot: { name: 'Godot', keywords: ['Godot', 'godot', 'GDScript', 'Node', 'scene', 'resource'] },
        unreal: { name: 'Unreal', keywords: ['Unreal', 'UE', 'Blueprint', 'Actor', 'Component', 'C++'] },
        cocos: { name: 'Cocos', keywords: ['Cocos', 'cocos', 'TypeScript', '组件', '预制体'] },
        production: { name: '制作', keywords: ['制作', '排期', 'sprint', '里程碑', 'milestone', '发布', 'release', '版本', '进度', '规划', '风险'] },
        testing: { name: '测试', keywords: ['测试', 'QA', 'test', '单元测试', '集成', 'bug', '回归', '验收'] },
        tooling: { name: '工具', keywords: ['工具', 'pipeline', 'CI/CD', 'build', 'automation', '编辑器', '脚本'] },
    },
};
// ── Config Loading ──
let _tagsConfig = null;
function resolveConfigPath() {
    const candidates = [
        join(process.cwd(), 'Config', 'memory-tags.yaml'),
        join(process.cwd(), 'config', 'memory-tags.yaml'),
    ];
    for (const p of candidates) {
        if (existsSync(p))
            return p;
        if (virtualExists(p))
            return p;
    }
    return null;
}
function loadTagsConfig() {
    if (_tagsConfig)
        return _tagsConfig;
    const configPath = resolveConfigPath();
    if (!configPath) {
        console.warn('[memory-tags] Config/memory-tags.yaml not found, using built-in defaults.');
        _tagsConfig = BUILTIN_TAGS;
        return _tagsConfig;
    }
    try {
        let raw;
        if (existsSync(configPath)) {
            raw = readFileSync(configPath, 'utf-8');
        }
        else {
            raw = virtualReadFile(configPath, 'utf-8');
        }
        const parsed = parseYaml(raw);
        if (!parsed?.tags || typeof parsed.tags !== 'object') {
            throw new Error('Invalid tags structure');
        }
        const tags = {};
        for (const [key, value] of Object.entries(parsed.tags)) {
            const def = value;
            if (!def?.name || !Array.isArray(def.keywords))
                continue;
            tags[key] = {
                name: String(def.name),
                keywords: def.keywords.map(String),
            };
        }
        if (Object.keys(tags).length === 0) {
            throw new Error('No valid tag definitions found');
        }
        _tagsConfig = { version: parsed.version ?? 1, tags };
        console.log(`[memory-tags] Loaded ${Object.keys(tags).length} tags from ${configPath}`);
        return _tagsConfig;
    }
    catch (err) {
        console.warn(`[memory-tags] Failed to load ${configPath}: ${err.message}. Using built-in defaults.`);
        _tagsConfig = BUILTIN_TAGS;
        return _tagsConfig;
    }
}
/** Get the loaded tags (config or fallback). */
export function getTagsConfig() {
    return loadTagsConfig();
}
/** Reset cached config (for testing / hot-reload). */
export function resetTagsConfig() {
    _tagsConfig = null;
}
// ── Derived Lookups ──
function buildNameLookup() {
    const config = loadTagsConfig();
    const lookup = {};
    for (const [key, def] of Object.entries(config.tags)) {
        lookup[def.name] = key; // Chinese name → key
        lookup[key] = key; // English key → key (alias)
    }
    return lookup;
}
let _nameLookupCache = null;
function getNameLookup() {
    if (!_nameLookupCache)
        _nameLookupCache = buildNameLookup();
    return _nameLookupCache;
}
export function resetNameLookup() {
    _nameLookupCache = null;
}
// ── Public API ──
/** All domain tag keys. */
export function allDomainTags() {
    return Object.keys(loadTagsConfig().tags);
}
/**
 * Match conversation context to domain tags.
 * Returns tags ordered by relevance score (highest first).
 */
export function matchContextTags(query, agentName, recentTools) {
    const config = loadTagsConfig();
    const lowerQuery = query.toLowerCase();
    const results = [];
    for (const [tag, def] of Object.entries(config.tags)) {
        let score = 0;
        for (const keyword of def.keywords) {
            if (lowerQuery.includes(keyword.toLowerCase())) {
                score += 1.0 + (keyword.length / 10);
            }
        }
        if (agentName) {
            const agentLower = agentName.toLowerCase();
            for (const keyword of def.keywords) {
                if (agentLower.includes(keyword.toLowerCase())) {
                    score += 2.0;
                }
            }
        }
        if (recentTools?.length) {
            const toolStr = recentTools.join(' ').toLowerCase();
            for (const keyword of def.keywords) {
                if (toolStr.includes(keyword.toLowerCase())) {
                    score += 1.5;
                }
            }
        }
        if (score > 0) {
            results.push({ tag, name: def.name, score });
        }
    }
    results.sort((a, b) => b.score - a.score);
    return results;
}
/**
 * Convert user-defined tag strings (from frontmatter `tags` field) to tag keys.
 * Accepts both Chinese names and English keys.
 */
export function resolveTags(tagStrings) {
    const lookup = getNameLookup();
    const resolved = [];
    for (const t of tagStrings) {
        const key = lookup[t.trim()];
        if (key && !resolved.includes(key)) {
            resolved.push(key);
        }
    }
    return resolved;
}
/**
 * Get the display name for a domain tag.
 */
export function getTagName(tag) {
    const config = loadTagsConfig();
    return config.tags[tag]?.name ?? tag;
}
/**
 * Build a compressed memory summary line for context injection.
 * Format: `[设计] Memory Name — one-line description`
 */
export function formatCompressedMemory(name, description, tags) {
    const tagNames = tags.length > 0
        ? tags.slice(0, 2).map(getTagName).join('/')
        : '通用';
    return `[${tagNames}] ${name} — ${description.slice(0, 120)}`;
}
/**
 * Build the compressed memory block for context injection.
 * Only includes tag + name + description, NOT full content.
 */
export function buildCompressedMemoryBlock(memories) {
    if (memories.length === 0)
        return '';
    const lines = ['<memory_index>'];
    lines.push('以下是与当前对话相关的记忆索引（摘要）。需要完整内容时说"查询记忆 XXX"：');
    lines.push('');
    for (const m of memories) {
        const resolvedTags = m.tagKeys ?? (m.tags ? resolveTags(m.tags) : []);
        lines.push(`- ${formatCompressedMemory(m.name, m.description, resolvedTags)}`);
    }
    lines.push('</memory_index>');
    return lines.join('\n');
}
//# sourceMappingURL=memory-tags.js.map