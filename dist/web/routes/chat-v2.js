/**
 * Chat API v2 — JSON + SSE response handlers for the React Web Console.
 *
 * POST /api/chat         → Non-streaming JSON (backward compat, quick Q&A)
 * POST /api/chat/stream  → SSE streaming (vibe coding — delegates to agent-runner.ts)
 *
 * Web path now shares the same agent-runner.ts engine as the CLI REPL:
 *   - Full system prompt (builtin-sections, rules, hooks, mode)
 *   - All 19 tools (Bash, Read, Write, Edit, Grep, Glob, Agent, TodoWrite, Tasks, Teams, WebSearch, etc.)
 *   - MCP tools (via loadAndRegisterMCPTools)
 *   - Multi-provider streaming (Anthropic + OpenAI native tool_use)
 *   - Prompt caching, micro-compact, token budget
 *
 * API source routing via models.config.yaml api.sources.
 */
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { calculateContextStats } from '../../context/monitor.js';
import { parse as parseYaml } from 'yaml';
import { runAgent } from '../../chat/agent-runner.js';
import { createSession, addMessage, load as loadSession } from '../../chat/session.js';
import { setProjectRoot, saveSession as persistSession } from '../../chat/storage.js';
import { resolveModel } from '../../generators/model-resolver.js';
import { resolveEnvValue } from '../../utils/env-resolver.js';
import { virtualExists, virtualReadFile, sanitizeAicorePaths, expandAicoreRefs, AICORE_ROOT, PKG_ROOT as VFS_PKG_ROOT } from '../../embedded/virtual-fs.js';
import { readEmbeddedFile, isBunCompiled } from '../../embedded/runtime.js';
import { notifyError, logDiagnostic } from '../../utils/error-logger.js';
let PKG_ROOT;
let AICORE_DIR;
let DEFAULT_PROJECT_ROOT;
// Use the canonical path resolution from virtual-fs.ts (handles Bun-compiled correctly).
// In compiled mode the binary has a flat virtual root, so ../.. navigation is wrong.
AICORE_DIR = AICORE_ROOT;
if (isBunCompiled) {
    // Bun-compiled: PKG_ROOT is the virtual binary root (used for embedded lookups).
    // The actual user project directory is process.cwd().
    PKG_ROOT = VFS_PKG_ROOT;
    const cwd = process.cwd();
    // Fallback: EXE directory when cwd is root or empty (e.g. launched from /)
    const exeDir = dirname(process.execPath);
    DEFAULT_PROJECT_ROOT = process.env.CODESQUAD_PROJECT_ROOT
        || (cwd && cwd !== '/' && cwd !== '\\' ? cwd : exeDir);
}
else {
    // Dev/tsx: use process.cwd() as the project root — this is the directory
    // where the user ran "codesquad web" (NOT the CLI installation directory).
    // PKG_ROOT is for embedded resource lookups (AICORE_DIR, templates), not file writes.
    try {
        const __dirname = fileURLToPath(new URL('.', import.meta.url));
        PKG_ROOT = join(__dirname, '..', '..', '..');
    }
    catch {
        PKG_ROOT = process.cwd();
    }
    DEFAULT_PROJECT_ROOT = process.env.CODESQUAD_PROJECT_ROOT || process.cwd();
}
/** Maps HTTP status codes to human-readable Chinese annotations. */
const STATUS_NOTE = {
    400: '请求参数错误',
    401: 'Key 无效或已过期',
    402: '余额不足',
    403: '账户权限不足或欠费',
    404: '模型不存在',
    429: '请求频率过高',
    500: '服务器内部错误',
    502: '上游服务异常',
    503: '服务暂时不可用',
};
// ── Helpers ──
function readBody(req, maxBytes = 1_048_576) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        req.on('data', (c) => {
            total += c.length;
            if (total > maxBytes) {
                req.destroy();
                reject(new Error('Request body too large (>1MB)'));
                return;
            }
            chunks.push(c);
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString()));
            }
            catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}
/** Try to read models.config.yaml — filesystem first, embedded fallback. */
function readModelsConfigRaw() {
    // 1) PKG_ROOT (bundled config)
    const configPath = join(PKG_ROOT, 'models.config.yaml');
    if (virtualExists(configPath))
        return virtualReadFile(configPath, 'utf-8');
    // 1b) Working directory (user-saved config via POST /api/models-config)
    const cwdPath = join(process.cwd(), 'models.config.yaml');
    if (virtualExists(cwdPath))
        return virtualReadFile(cwdPath, 'utf-8');
    // 2) Embedded fallback (Bun-compiled mode)
    try {
        return readEmbeddedFile('models.config.yaml');
    }
    catch {
        return null;
    }
}
/** Load API source configuration from models.config.yaml */
function loadApiSources() {
    try {
        const raw = readModelsConfigRaw();
        if (!raw)
            return {};
        const config = parseYaml(raw);
        return config?.api?.sources ?? {};
    }
    catch (err) {
        console.warn(`[chat-v2] Failed to parse models.config.yaml: ${err.message}`);
        return {};
    }
}
/**
 * Load models.config.yaml for model resolution (agents, skills, batch, default).
 *
 * NOTE: `api.sources` is NOT loaded here — use `loadApiSources()` for that.
 * This function only provides model-name mapping (batch globs + default model)
 * used by `resolveBatchModel()` during API source resolution.
 */
function loadFullModelsConfig() {
    try {
        const raw = readModelsConfigRaw();
        if (!raw)
            return { version: 1 };
        const config = parseYaml(raw);
        return {
            version: config.version ?? 1,
            agents: config.agents ?? undefined,
            skills: config.skills ?? undefined,
            batch: config.batch ?? undefined,
            default: config.default,
        };
    }
    catch (err) {
        console.warn(`[chat-v2] Failed to parse full models config: ${err.message}`);
        return { version: 1 };
    }
}
/** Map model name to API source key (e.g. "Deepseek-V4-Pro" → "deepseek-v4-pro") */
function modelToSourceKey(modelName) {
    // Direct mapping: lowercase and replace spaces/underscores with hyphens
    return modelName.toLowerCase().replace(/[\s_]+/g, '-');
}
/** Load agent system prompt from .codesquad (virtual-fs for embedded support) */
function loadAgentPrompt(name) {
    const p = join(AICORE_DIR, 'agents', `${name}.md`);
    try {
        return virtualExists(p) ? virtualReadFile(p, 'utf-8') : null;
    }
    catch (err) {
        console.warn(`[chat-v2] Failed to load agent prompt '${name}':`, err.message);
        return null;
    }
}
/** Load skill prompt from .codesquad (virtual-fs for embedded support) */
function loadSkillPrompt(name) {
    const p = join(AICORE_DIR, 'skills', name, 'SKILL.md');
    try {
        return virtualExists(p) ? virtualReadFile(p, 'utf-8') : null;
    }
    catch {
        return null;
    }
}
// ── API Source resolution ──
/**
 * Apply batch model-name glob patterns from models.config.yaml.
 * E.g. "Deepseek-V4-Pro" matching pattern "Deepseek-V4-Pro*" → "deepseek-v4-pro-202606".
 */
function resolveBatchModel(modelName, config) {
    if (!config?.batch)
        return modelName;
    for (const [pattern, replacement] of Object.entries(config.batch)) {
        // Glob matching: * → .*, escape regex special chars
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        try {
            if (new RegExp(`^${escaped}$`, 'i').test(modelName)) {
                return replacement;
            }
        }
        catch { /* invalid regex from pattern, skip */ }
    }
    return modelName;
}
function resolveApiConfig(modelName, customSources) {
    // Priority 0: Apply batch model-name mapping before source lookup
    const fullConfig = loadFullModelsConfig();
    const mappedModel = resolveBatchModel(modelName, fullConfig);
    // Priority 1: customSources from the request
    if (customSources) {
        const sourceKey = modelToSourceKey(mappedModel);
        const custom = customSources[sourceKey];
        if (custom?.baseUrl && custom?.apiKey) {
            return {
                baseUrl: custom.baseUrl,
                apiKey: resolveEnvValue(custom.apiKey) || '',
                resolvedModel: mappedModel,
                sourceKey,
                provider: custom.provider || 'openai-compatible',
            };
        }
    }
    // Priority 2: models.config.yaml api.sources
    const configSources = loadApiSources();
    const sourceKey = modelToSourceKey(mappedModel);
    const configSource = configSources[sourceKey];
    if (configSource?.baseUrl && configSource?.apiKey) {
        return {
            baseUrl: configSource.baseUrl,
            apiKey: resolveEnvValue(configSource.apiKey) || '',
            resolvedModel: mappedModel,
            sourceKey,
            provider: configSource.provider || 'openai-compatible',
        };
    }
    // Priority 3: Use the first available API source as fallback
    const firstKey = Object.keys(configSources)[0];
    if (firstKey) {
        const fallback = configSources[firstKey];
        return {
            baseUrl: fallback.baseUrl,
            apiKey: resolveEnvValue(fallback.apiKey) || '',
            resolvedModel: mappedModel,
            sourceKey: firstKey,
            provider: fallback.provider || 'openai-compatible',
        };
    }
    return null;
}
/**
 * Build a RuntimeProviderConfig from the resolved API source.
 * This bridges models.config.yaml api.sources → LLM client's provider config.
 */
function buildRuntimeProviderConfig(apiConfig) {
    // Map models.config.yaml provider field to protocol wire format
    const provider = apiConfig.provider?.toLowerCase() || '';
    const protocol = provider === 'anthropic' ? 'anthropic'
        : provider === 'openai' ? 'openai'
            : 'openai-compatible';
    return {
        id: apiConfig.sourceKey,
        name: apiConfig.sourceKey,
        protocol,
        baseUrl: apiConfig.baseUrl,
        models: [apiConfig.resolvedModel],
        defaultModel: apiConfig.resolvedModel,
        envVar: '',
        apiKey: apiConfig.apiKey,
    };
}
// ── Main handler (non-streaming, backward compat) ──
/**
 * P1 fix: now delegates to runAgent() (shared execution engine) instead of
 * manually building a system prompt and calling the LLM directly. This ensures:
 *   - Full tool execution loop (Bash, Read, Write, Edit, Grep, Glob, etc.)
 *   - Prompt caching + system prompt from agent-runner (builtin-sections, rules, hooks)
 *   - Fallback provider chain
 *   - Token budget + auto-compact
 *   - Consistent behavior with the streaming endpoint
 */
export async function handleChatV2(req, res) {
    let body;
    try {
        body = (await readBody(req));
    }
    catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
    }
    const { prompt, history, modelName, agentId, skillId, mode, lang, memorySummaryMode, customSources, generationConfig } = body;
    if (!prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'prompt is required' }));
        return;
    }
    // Semantic routing — auto-select best agent when agentId not specified
    let effectiveAgentName = agentId || 'game-designer';
    if (!agentId) {
        try {
            const { resolveAgent } = await import('../../embedding/router.js');
            const route = await resolveAgent(prompt);
            if (route) {
                effectiveAgentName = route.target.name;
                console.log(`[Router] ${route.method} → ${effectiveAgentName} (score: ${route.score?.toFixed(3) ?? 'N/A'})`);
            }
        }
        catch { /* routing non-critical */ }
    }
    const modelsConfig = loadFullModelsConfig();
    // Resolve target model: skill frontmatter model > request modelName > default
    let targetModel = modelName || 'Deepseek-V4-Pro';
    let resolveType = 'agent';
    let resolveName = effectiveAgentName;
    if (skillId) {
        try {
            const { loadSkill } = await import('../../repl/skill-registry.js');
            const skillDef = loadSkill(skillId);
            if (skillDef?.model) {
                targetModel = skillDef.model;
                resolveType = 'skill';
                resolveName = skillId;
            }
        }
        catch {
            // Skill model resolution is non-critical
        }
    }
    const resolvedModel = resolveModel(targetModel, resolveName, resolveType, modelsConfig);
    const apiConfig = resolveApiConfig(resolvedModel, customSources);
    if (!apiConfig) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No API source configured' }));
        return;
    }
    const effectiveMode = (mode || 'ask').toLowerCase();
    const chatMode = effectiveMode === 'craft' ? 'craft' : effectiveMode === 'plan' ? 'plan' : 'ask';
    // Build RuntimeProviderConfig from models.config.yaml
    const runtimeConfig = buildRuntimeProviderConfig(apiConfig);
    // Create session
    const requestSessionId = body.sessionId;
    let session = requestSessionId ? (await loadSession(requestSessionId)) : null;
    if (!session) {
        session = createSession(effectiveAgentName, {
            provider: apiConfig.sourceKey,
            model: resolvedModel,
            maxTokens: generationConfig?.maxTokens ?? 4096,
            temperature: generationConfig?.temperature ?? 0.7,
        });
        if (history && history.length > 0) {
            for (const msg of history.slice(-20)) {
                if (msg.sender !== 'user' && msg.sender !== 'assistant')
                    continue;
                addMessage(session, msg.sender, msg.content);
            }
        }
    }
    // Inject skill guidance if skillId provided
    if (skillId) {
        try {
            const { setAicodeRoot, loadSkill } = await import('../../repl/skill-registry.js');
            setAicodeRoot(AICORE_DIR);
            const skill = loadSkill(skillId);
            if (skill) {
                const skillMdPath = join(AICORE_DIR, 'skills', skillId, 'SKILL.md');
                if (virtualExists(skillMdPath)) {
                    const skillContent = virtualReadFile(skillMdPath, 'utf-8');
                    const sanitized = expandAicoreRefs(sanitizeAicorePaths(skillContent));
                    if (skill.context === 'fork') {
                        const { markForkSkill } = await import('../../context/fork-executor.js');
                        markForkSkill(session, { skillName: skillId, content: sanitized, model: skill.model });
                    }
                    else {
                        session.context.injectedContent = `## Activated Skill: ${skillId}\n${sanitized}\n`;
                    }
                }
            }
        }
        catch {
            // Non-critical — agent still works without skill injection
        }
    }
    // P1 fix: delegate to shared runAgent() execution engine
    try {
        const result = await runAgent({
            agentName: effectiveAgentName,
            userInput: prompt,
            session,
            providerId: apiConfig.sourceKey,
            modelId: resolvedModel,
            projectRoot: DEFAULT_PROJECT_ROOT,
            aicoreDir: AICORE_DIR,
            mode: chatMode,
            maxTurns: 20,
            lang: lang || 'zh',
            memorySummaryMode,
            runtimeConfig,
            stream: false,
        });
        // Persist session
        try {
            setProjectRoot(DEFAULT_PROJECT_ROOT);
            await persistSession(session);
        }
        catch { /* non-critical */ }
        // ── Handle interactive pauses (AskUserQuestion / permission) ──
        if (result.needsUserInput) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                needsUserInput: true,
                questions: result.needsUserInput.questions,
                toolCallId: result.needsUserInput.toolCallId,
                sessionId: session.id,
                _deprecated: true,
                _migration: 'Use POST /api/chat/stream for interactive Q&A.',
            }));
            return;
        }
        if (result.needsApproval) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                needsApproval: true,
                toolName: result.needsApproval.toolName,
                message: result.needsApproval.message,
                toolCallId: result.needsApproval.toolCallId,
                sessionId: session.id,
                _deprecated: true,
                _migration: 'Use POST /api/chat/stream for permission dialogs.',
            }));
            return;
        }
        // Return JSON response (deprecated but functional)
        res.writeHead(200, {
            'Content-Type': 'application/json',
            Deprecation: 'true',
            Sunset: '2026-12-31T23:59:59Z',
            Link: '</api/chat/stream>; rel="successor-version"',
        });
        res.end(JSON.stringify({
            content: result.finalResponse,
            turns: result.turnsUsed,
            toolCalls: result.toolCallsMade,
            sessionId: session.id,
            durationMs: result.durationMs,
            _deprecated: true,
            _migration: 'Use POST /api/chat/stream for full vibe coding with tools, SSE streaming, and permission support.',
        }));
    }
    catch (err) {
        const e = err;
        console.error('[chat-v2] runAgent error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message || 'Internal server error' }));
    }
}
// ── Streaming Chat (SSE) — Unified agent-runner.ts integration ──
/**
 * POST /api/chat/stream
 *
 * Streaming chat with Server-Sent Events, now powered by agent-runner.ts.
 * Shares the same execution engine as the CLI REPL:
 *   - Full system prompt (builtin-sections, rules, hooks)
 *   - All 19+ tools (Bash, Read, Write, Edit, Grep, Glob, Agent, TodoWrite, etc.)
 *   - MCP tools
 *   - Native function calling (Anthropic tool_use / OpenAI function calling)
 *   - Prompt caching + micro-compact + token budget
 *
 * SSE event types:
 *   data: {"type":"token","text":"Hello"}
 *   data: {"type":"tool_call","name":"Read","input":{...}}
 *   data: {"type":"tool_result","name":"Read","content":"..."}
 *   data: {"type":"question","questions":[...]}
 *   data: {"type":"done","content":"final text","turns":3}
 *   data: {"type":"error","error":"..."}
 *   data: [DONE]
 */
export async function handleChatStream(req, res) {
    let body;
    try {
        body = (await readBody(req));
    }
    catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
    }
    const { prompt, history, modelName, agentId, skillId, mode, lang, thinkingMode, searchProvider, memorySummaryMode, customSources, generationConfig } = body;
    // Apply search provider preference
    if (searchProvider) {
        process.env.SEARCH_PROVIDER = searchProvider;
    }
    if (!prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'prompt is required' }));
        return;
    }
    // 🔧 Step 9: 语义路由 — 无显式 agentId 时自动匹配最佳 agent
    let effectiveAgentName = agentId || 'game-designer';
    if (!agentId) {
        try {
            const { resolveAgent } = await import('../../embedding/router.js');
            const route = await resolveAgent(prompt);
            if (route) {
                effectiveAgentName = route.target.name;
                console.log(`[Router] ${route.method} → ${effectiveAgentName} (score: ${route.score?.toFixed(3) ?? 'N/A'})`);
            }
        }
        catch { /* routing non-critical */ }
    }
    const modelsConfig = loadFullModelsConfig();
    // Resolve the target model: skill's frontmatter model > request modelName > default
    let targetModel = modelName || 'Deepseek-V4-Pro';
    let resolveType = 'agent';
    let resolveName = effectiveAgentName;
    // When a skill is invoked, its frontmatter `model` field should take priority.
    // E.g. /onboard specifies `model: Deepseek-V4-Flash` which differs from the
    // game-designer agent's Kimi-K2.6 default.
    if (skillId) {
        try {
            const { loadSkill } = await import('../../repl/skill-registry.js');
            const skillDef = loadSkill(skillId);
            if (skillDef?.model) {
                targetModel = skillDef.model;
                resolveType = 'skill';
                resolveName = skillId;
            }
        }
        catch {
            // Skill model resolution is non-critical — fall through to agent config
        }
    }
    const resolvedModel = resolveModel(targetModel, resolveName, resolveType, modelsConfig);
    const apiConfig = resolveApiConfig(resolvedModel, customSources);
    if (!apiConfig) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No API source configured' }));
        return;
    }
    // SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    let sseClosedWarned = false;
    const sendSSE = (data) => {
        try {
            const payload = JSON.stringify(data);
            try {
                res.write(`data: ${payload}\n\n`);
            }
            catch {
                if (!sseClosedWarned) {
                    console.warn('[chat-v2] SSE write failed — client likely disconnected');
                    logDiagnostic('WARN', 'chat-v2', 'SSE write failed — client likely disconnected');
                    sseClosedWarned = true;
                }
            }
        }
        catch (serializeErr) {
            // JSON.stringify can throw on circular references / BigInt
            console.error('[chat-v2] Failed to serialize SSE data:', serializeErr);
            logDiagnostic('ERROR', 'chat-v2', 'Failed to serialize SSE data', { error: String(serializeErr) });
            try {
                res.write(`data: ${JSON.stringify({ error: 'Failed to serialize response', type: 'error' })}\n\n`);
            }
            catch { /* double-fault: connection already dead */ }
        }
    };
    // Map mode string to ChatMode
    const effectiveMode = (mode || 'ask').toLowerCase();
    const chatMode = effectiveMode === 'craft' ? 'craft' : effectiveMode === 'plan' ? 'plan' : 'ask';
    // Build RuntimeProviderConfig from models.config.yaml
    const runtimeConfig = buildRuntimeProviderConfig(apiConfig);
    // ── Session management: load existing session or create new one ──
    // Supports multi-turn AskUserQuestion re-invoke and history preservation.
    const requestSessionId = body.sessionId;
    let session = requestSessionId ? (await loadSession(requestSessionId)) : null;
    if (!session) {
        session = createSession(effectiveAgentName, {
            provider: apiConfig.sourceKey,
            model: resolvedModel,
            maxTokens: generationConfig?.maxTokens ?? 4096,
            temperature: generationConfig?.temperature ?? 0.7,
        });
        // Inject history from the request body (for multi-turn continuity)
        // Only include user/assistant messages — skip system, info, shell to avoid leaking non-chat content into LLM context
        if (history && history.length > 0) {
            for (const msg of history.slice(-20)) {
                if (msg.sender !== 'user' && msg.sender !== 'assistant')
                    continue;
                addMessage(session, msg.sender, msg.content);
            }
        }
    }
    // ── Inject skill guidance if skillId provided ──
    // IMPORTANT: When switching skills, clear previous skill's injected content to avoid
    // context pollution (LLM seeing instructions from multiple skills simultaneously).
    let skillThinkingLevel;
    if (skillId) {
        const currentInjected = session.context.injectedContent || '';
        const alreadyInjected = currentInjected.includes(`Skill: ${skillId}`);
        if (!alreadyInjected) {
            // Different skill → clear old content, inject only the new skill
            session.context.injectedContent = '';
            try {
                const { setAicodeRoot, loadSkill } = await import('../../repl/skill-registry.js');
                setAicodeRoot(AICORE_DIR);
                const skill = loadSkill(skillId);
                skillThinkingLevel = skill?.thinkingLevel;
                console.log(`[chat-v2] Skill "${skillId}" loaded: context=${skill?.context}, model=${skill?.model}, thinkingLevel=${skillThinkingLevel ?? '(inherit)'}, allowedTools=${skill?.allowedTools?.length ?? 0}`);
                logDiagnostic('INFO', 'chat-v2', `Skill "${skillId}" loaded`, {
                    context: skill?.context,
                    model: skill?.model,
                    allowedToolsCount: skill?.allowedTools?.length ?? 0,
                });
                if (skill) {
                    const skillMdPath = join(AICORE_DIR, 'skills', skillId, 'SKILL.md');
                    if (virtualExists(skillMdPath)) {
                        const skillContent = virtualReadFile(skillMdPath, 'utf-8');
                        const sanitized = expandAicoreRefs(sanitizeAicorePaths(skillContent));
                        // Fork context: mark for isolated execution instead of injecting into parent session.
                        // agent-runner will pick up the marker and execute the skill in an ephemeral session,
                        // returning only the summary to the parent conversation.
                        if (skill.context === 'fork') {
                            const { markForkSkill } = await import('../../context/fork-executor.js');
                            markForkSkill(session, {
                                skillName: skillId,
                                content: sanitized,
                                model: skill.model,
                            });
                        }
                        else {
                            session.context.injectedContent =
                                `## Activated Skill: ${skillId}\n${sanitized}\n`;
                        }
                    }
                }
            }
            catch (skillErr) {
                // Skill guidance failed — notify the frontend via SSE error event
                // so the user knows why the skill didn't activate as expected.
                const msg = skillErr instanceof Error ? skillErr.message : 'Unknown skill load error';
                console.error(`[chat-v2] Skill "${skillId}" load failed:`, msg);
                logDiagnostic('ERROR', 'chat-v2', `Skill "${skillId}" load failed`, { error: msg });
                sendSSE({
                    type: 'error',
                    error: `技能 "${skillId}" 加载失败: ${msg}`,
                });
            }
        }
    }
    // ── Call runAgent() — the shared execution engine ──
    let result;
    try {
        result = await runAgent({
            agentName: effectiveAgentName,
            userInput: prompt,
            session,
            providerId: apiConfig.sourceKey,
            modelId: resolvedModel,
            projectRoot: DEFAULT_PROJECT_ROOT,
            aicoreDir: AICORE_DIR,
            mode: chatMode,
            maxTurns: 20,
            lang: lang || 'zh',
            thinkingMode: thinkingMode || 'fast',
            skillThinkingLevel,
            memorySummaryMode,
            runtimeConfig,
            stream: true,
            onToken(text) {
                sendSSE({ type: 'token', text });
            },
            onThinking(text) {
                sendSSE({ type: 'thinking', text });
            },
            onTurn(turn, _response, toolCalls) {
                if (toolCalls && toolCalls.length > 0) {
                    for (const tc of toolCalls) {
                        sendSSE({ type: 'tool_call', name: tc.name, input: tc.input });
                    }
                }
            },
            onToolUse(toolName, _input, toolResult) {
                sendSSE({
                    type: 'tool_result',
                    name: toolName,
                    content: toolResult.content,
                    isError: toolResult.isError,
                });
            },
            onToolProgress(progress) {
                sendSSE({
                    type: 'tool_progress',
                    completed: progress.completed,
                    total: progress.total,
                    currentTool: progress.currentTool,
                    phase: progress.phase,
                });
            },
            onError(message) {
                sendSSE({ type: 'error', error: message });
            },
        });
    }
    catch (err) {
        const e = err;
        sendSSE({ type: 'error', error: e.message });
        // Trace log + email notification (if configured)
        notifyError('chat-v2', e, {
            agentName: effectiveAgentName,
            modelId: resolvedModel,
            sessionId: session.id,
            skillId,
            prompt: prompt.substring(0, 200),
        });
        res.write('data: [DONE]\n\n');
        res.end();
        return;
    }
    // ── Persist session for multi-turn (AskUserQuestion re-invoke) ──
    try {
        setProjectRoot(DEFAULT_PROJECT_ROOT);
        await persistSession(session);
    }
    catch (persistErr) {
        // Persistence failure is non-critical for the current request,
        // but log it so we know sessions may be lost on restart.
        console.warn('[chat-v2] Session persist failed:', persistErr);
        logDiagnostic('WARN', 'chat-v2', 'Session persist failed', { error: String(persistErr) });
    }
    // ── Handle permission approval pause (Phase 3) ──
    if (result.needsApproval) {
        sendSSE({
            type: 'permission_required',
            toolName: result.needsApproval.toolName,
            message: result.needsApproval.message,
            toolCallId: result.needsApproval.toolCallId,
            input: result.needsApproval.input,
            sessionId: session.id,
        });
        res.write('data: [DONE]\n\n');
        res.end();
        return;
    }
    // ── Handle AskUserQuestion pause ──
    if (result.needsUserInput) {
        // Calculate context stats for frontend TokenRing display
        const contextStats = session.messages.length > 0
            ? calculateContextStats(session.messages, resolvedModel)
            : null;
        sendSSE({
            type: 'question',
            questions: result.needsUserInput.questions,
            toolCallId: result.needsUserInput.toolCallId,
            sessionId: session.id,
            stats: contextStats ? {
                percentUsed: contextStats.percentUsed,
                totalTokens: contextStats.totalTokens,
                contextWindow: contextStats.contextWindow,
                isWarning: contextStats.isWarning,
                isCritical: contextStats.isCritical,
            } : undefined,
        });
        res.write('data: [DONE]\n\n');
        res.end();
        return;
    }
    // ── Final response ──
    // Calculate context stats for frontend TokenRing display
    const contextStats = session.messages.length > 0
        ? calculateContextStats(session.messages, resolvedModel)
        : null;
    // 🔍 Critical diagnostic: log exact finalResponse being sent to frontend
    logDiagnostic('INFO', 'chat-v2', 'runAgent completed', {
        finalResponseLen: result.finalResponse?.length ?? 0,
        finalResponseStart: (result.finalResponse ?? '').slice(0, 200),
        turnsUsed: result.turnsUsed,
        toolCallsMade: result.toolCallsMade,
        hasError: !!result.error,
        errorMsg: result.error?.slice(0, 200),
        needsUserInput: !!result.needsUserInput,
        needsApproval: !!result.needsApproval,
        sessionMsgCount: session.messages.length,
    });
    if (result.error) {
        sendSSE({ type: 'error', error: result.error });
    }
    else {
        sendSSE({
            type: 'done',
            content: result.finalResponse,
            turns: result.turnsUsed,
            durationMs: result.durationMs,
            sessionId: session.id,
            stats: contextStats ? {
                percentUsed: contextStats.percentUsed,
                totalTokens: contextStats.totalTokens,
                contextWindow: contextStats.contextWindow,
                isWarning: contextStats.isWarning,
                isCritical: contextStats.isCritical,
            } : undefined,
        });
    }
    res.write('data: [DONE]\n\n');
    res.end();
}
// ── Permission Response Endpoint (Feature 7, P5) ──
/**
 * POST /api/chat/respond-permission
 *
 * Accepts user's response to a tool permission request.
 * Body: { sessionId, toolCallId, approved: boolean }
 */
export async function handlePermissionResponse(req, res) {
    let body;
    try {
        body = (await readBody(req));
    }
    catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
    }
    const { sessionId, toolCallId, approved } = body;
    if (!sessionId || !toolCallId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sessionId and toolCallId are required' }));
        return;
    }
    // Phase 3: Inject approval/denial result into the session context,
    // so the next stream re-invoke continues from where it left off.
    try {
        setProjectRoot(DEFAULT_PROJECT_ROOT);
        let session = await loadSession(sessionId);
        if (session) {
            if (approved) {
                addMessage(session, 'user', `[Tool Call Approved by User]\nTool: ${toolCallId}\nThe user approved this operation.`);
            }
            else {
                addMessage(session, 'user', `[Permission Denied by User]\nTool: ${toolCallId}\nThe user rejected this operation.`);
            }
            await persistSession(session);
        }
    }
    catch {
        // Session update is best-effort
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        ok: true,
        sessionId,
        toolCallId,
        approved: approved ?? false,
    }));
}
//# sourceMappingURL=chat-v2.js.map