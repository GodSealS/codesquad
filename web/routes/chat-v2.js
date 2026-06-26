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
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { calculateContextStats } from '../../context/monitor.js';
import { parse as parseYaml } from 'yaml';
import { runAgent } from '../../chat/agent-runner.js';
import { createSession, addMessage, load as loadSession } from '../../chat/session.js';
import { setProjectRoot, saveSession as persistSession } from '../../chat/storage.js';
import { resolveModel } from '../../generators/model-resolver.js';
import { resolveEnvValue } from '../../utils/env-resolver.js';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PKG_ROOT = join(__dirname, '..', '..', '..');
const AICORE_DIR = join(PKG_ROOT, 'AICore');
// ── Helpers ──
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
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
/** Load API source configuration from models.config.yaml */
function loadApiSources() {
    const configPath = join(PKG_ROOT, 'models.config.yaml');
    try {
        if (!existsSync(configPath))
            return {};
        const raw = readFileSync(configPath, 'utf-8');
        const config = parseYaml(raw);
        return config?.api?.sources ?? {};
    }
    catch {
        return {};
    }
}
/** Load full models config (agents, skills, batch, default) for model resolution */
function loadFullModelsConfig() {
    const configPath = join(PKG_ROOT, 'models.config.yaml');
    try {
        if (!existsSync(configPath))
            return { version: 1, api: { sources: {} } };
        const raw = readFileSync(configPath, 'utf-8');
        const config = parseYaml(raw);
        return {
            version: config.version ?? 1,
            api: { sources: {} },
            agents: config.agents ?? undefined,
            skills: config.skills ?? undefined,
            batch: config.batch ?? undefined,
            default: config.default,
        };
    }
    catch {
        return { version: 1, api: { sources: {} } };
    }
}
/** Map model name to API source key (e.g. "Deepseek-V4-Pro" → "deepseek-v4-pro") */
function modelToSourceKey(modelName) {
    // Direct mapping: lowercase and replace spaces/underscores with hyphens
    return modelName.toLowerCase().replace(/[\s_]+/g, '-');
}
/** Load agent system prompt from AICore */
function loadAgentPrompt(name) {
    const p = join(AICORE_DIR, 'agents', `${name}.md`);
    try {
        return existsSync(p) ? readFileSync(p, 'utf-8') : null;
    }
    catch {
        return null;
    }
}
/** Load skill prompt from AICore */
function loadSkillPrompt(name) {
    const p = join(AICORE_DIR, 'skills', name, 'SKILL.md');
    try {
        return existsSync(p) ? readFileSync(p, 'utf-8') : null;
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
    const { prompt, history, modelName, agentId, skillId, mode, customSources, attachments, generationConfig } = body;
    if (!prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'prompt is required' }));
        return;
    }
    const effectiveAgentName = agentId || 'game-designer';
    const targetModel = modelName || 'Deepseek-V4-Pro';
    const modelsConfig = loadFullModelsConfig();
    const resolvedModel = resolveModel(targetModel, effectiveAgentName, 'agent', modelsConfig);
    const apiConfig = resolveApiConfig(resolvedModel, customSources);
    if (!apiConfig) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No API source configured. Please set up models.config.yaml or provide customSources.' }));
        return;
    }
    // Build system prompt from agent/skill
    let systemPrompt = '';
    if (agentId) {
        const agentPrompt = loadAgentPrompt(agentId);
        if (agentPrompt)
            systemPrompt += agentPrompt + '\n\n';
    }
    if (skillId) {
        const skillPrompt = loadSkillPrompt(skillId);
        if (skillPrompt)
            systemPrompt += `[Skill: ${skillId}]\n${skillPrompt}\n\n`;
    }
    // Mode-specific augmentation
    const effectiveMode = mode || 'Ask';
    if (systemPrompt) {
        switch (effectiveMode.toLowerCase()) {
            case 'ask':
                systemPrompt = `[MODE: ASK — READ-ONLY]\nYou are in ASK mode. You can read files, search code, browse documentation, and answer questions. Do NOT write, edit, delete, or create any files. Do NOT run commands that modify the project.\n\n${systemPrompt}`;
                break;
            case 'plan':
                systemPrompt = `[MODE: PLAN — STRATEGIC ANALYSIS]\nYou are in PLAN mode. Analyze the current state, propose architectural decisions, create detailed implementation plans, and outline steps. Do NOT implement any code or modify any files.\n\n${systemPrompt}`;
                break;
            // craft: use unchanged
        }
    }
    // Build messages
    const messages = [];
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    // Add history
    if (history && history.length > 0) {
        for (const msg of history.slice(-20)) {
            if (msg.sender === 'user') {
                messages.push({ role: 'user', content: msg.content });
            }
            else if (msg.sender === 'assistant') {
                messages.push({ role: 'assistant', content: msg.content });
            }
        }
    }
    // Add current user message (with attachment context if any)
    let userContent = prompt;
    if (attachments && attachments.length > 0) {
        userContent += '\n\n[Attached files:]\n';
        for (const att of attachments) {
            if (att.type?.startsWith('image/')) {
                userContent += `\n[Image: ${att.name}]`;
            }
            else {
                userContent += `\n--- ${att.name} ---\n${att.content?.slice(0, 5000) ?? ''}\n--- end ---`;
            }
        }
    }
    messages.push({ role: 'user', content: userContent });
    // Call the API
    try {
        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiConfig.apiKey}`,
            },
            body: JSON.stringify({
                model: apiConfig.resolvedModel,
                messages,
                max_tokens: generationConfig?.maxTokens ?? 4096,
                temperature: generationConfig?.temperature ?? 0.7,
                top_p: generationConfig?.topP ?? 0.95,
            }),
        });
        if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            console.error(`[chat-v2] API error ${response.status}: ${errText.slice(0, 500)}`);
            res.writeHead(response.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `API error ${response.status}: ${errText.slice(0, 200)}` }));
            return;
        }
        const data = (await response.json());
        const content = data.choices?.[0]?.message?.content ?? '';
        res.writeHead(200, {
            'Content-Type': 'application/json',
            Deprecation: 'true',
            Sunset: '2026-12-31T23:59:59Z',
            Link: '</api/chat/stream>; rel="successor-version"',
        });
        res.end(JSON.stringify({
            content,
            modelUsed: data.model || resolvedModel,
            modeUsed: effectiveMode,
            _deprecated: true,
            _migration: 'Use POST /api/chat/stream for full vibe coding with tools, SSE streaming, and permission support.',
        }));
    }
    catch (err) {
        console.error('[chat-v2] Fetch error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }));
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
    const { prompt, history, modelName, agentId, skillId, mode, lang, thinkingMode, searchProvider, customSources, generationConfig } = body;
    // Apply search provider preference
    if (searchProvider) {
        process.env.SEARCH_PROVIDER = searchProvider;
    }
    if (!prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'prompt is required' }));
        return;
    }
    const targetModel = modelName || 'Deepseek-V4-Pro';
    const effectiveAgentName = agentId || 'game-designer';
    const modelsConfig = loadFullModelsConfig();
    const resolvedModel = resolveModel(targetModel, effectiveAgentName, 'agent', modelsConfig);
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
    const sendSSE = (data) => {
        try {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
        catch { /* connection closed */ }
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
    if (skillId && !(session.context.injectedContent || '').includes(`Skill: ${skillId}`)) {
        try {
            const { setAicodeRoot, loadSkill } = await import('../../repl/skill-registry.js');
            setAicodeRoot(AICORE_DIR);
            const skill = loadSkill(skillId);
            if (skill) {
                const skillMdPath = join(AICORE_DIR, 'skills', skillId, 'SKILL.md');
                if (existsSync(skillMdPath)) {
                    const skillContent = readFileSync(skillMdPath, 'utf-8');
                    session.context.injectedContent =
                        (session.context.injectedContent || '') +
                            `\n## Activated Skill: ${skillId}\n${skillContent}\n`;
                }
            }
        }
        catch {
            // Skill guidance is non-critical — skip on failure
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
            projectRoot: process.cwd(),
            aicoreDir: AICORE_DIR,
            mode: chatMode,
            maxTurns: 20,
            lang: lang || 'zh',
            thinkingMode: thinkingMode || 'fast',
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
            onError(message) {
                sendSSE({ type: 'error', error: message });
            },
        });
    }
    catch (err) {
        sendSSE({ type: 'error', error: err.message });
        res.write('data: [DONE]\n\n');
        res.end();
        return;
    }
    // ── Persist session for multi-turn (AskUserQuestion re-invoke) ──
    try {
        setProjectRoot(process.cwd());
        await persistSession(session);
    }
    catch {
        // Persistence failure is non-critical
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
    if (result.error) {
        sendSSE({ type: 'error', error: result.error });
    }
    else {
        sendSSE({
            type: 'done',
            content: result.finalResponse,
            turns: result.turnsUsed,
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
        setProjectRoot(process.cwd());
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