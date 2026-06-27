/**
 * Chat API — SSE streaming agent conversation.
 *
 * POST /api/chat with { sessionId?, agent, message, modelConfig? }
 * Returns SSE stream with events: status, text, tool, tool_result, usage, error, done.
 */
import { createSession, load, save, addMessage } from '../../chat/session.js';
import { calculateCost, recordUsage, checkBudget, formatBudgetWarning } from '../../llm/usage-tracker.js';
import { buildRuntimeConfig } from '../../llm/registry.js';
import { callLLM, LlmError } from '../../llm/client.js';
import { detectOllama, registerOllamaProvider, callOllama } from '../../llm/fallback.js';
import { createSSEStream } from '../sse.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { virtualExists, virtualReadFile } from '../../embedded/virtual-fs.js';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const AICORE_DIR = join(__dirname, '..', '..', '..', 'AICore');
function loadAgentPrompt(name) {
    const p = join(AICORE_DIR, 'agents', `${name}.md`);
    try {
        return virtualExists(p) ? virtualReadFile(p, 'utf-8') : null;
    }
    catch {
        return null;
    }
}
function loadSkillPrompt(name) {
    const p = join(AICORE_DIR, 'skills', name, 'SKILL.md');
    try {
        return virtualExists(p) ? virtualReadFile(p, 'utf-8') : null;
    }
    catch {
        return null;
    }
}
/** Read request body as JSON. */
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
export async function handleChat(req, res, services) {
    let body;
    try {
        body = await readBody(req);
    }
    catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
    }
    const agent = body.agent;
    const message = body.message;
    const sessionId = body.sessionId;
    const modelConfig = body.modelConfig;
    const mode = body.mode || 'craft';
    const images = body.images;
    if (!agent || !message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'agent and message are required' }));
        return;
    }
    // ── Load or create session ──
    let session;
    if (sessionId) {
        const existing = await load(sessionId);
        if (!existing) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Session not found' }));
            return;
        }
        session = existing;
    }
    else {
        session = createSession(agent, modelConfig ?? { provider: 'anthropic', model: 'claude-sonnet-4-20250514' });
    }
    // Always update session modelConfig if client sent one
    if (modelConfig) {
        session.modelConfig = modelConfig;
    }
    const agentPrompt = loadAgentPrompt(agent);
    if (!agentPrompt) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Agent not found: ${agent}` }));
        return;
    }
    // ── Mode-specific prompt augmentation ──
    let augmentedPrompt = agentPrompt;
    switch (mode) {
        case 'ask':
            augmentedPrompt = `[MODE: ASK — READ-ONLY]\nYou are in ASK mode. You can read files, search code, browse documentation, and answer questions. Do NOT write, edit, delete, or create any files. Do NOT run commands that modify the project.\n\n${agentPrompt}`;
            break;
        case 'plan':
            augmentedPrompt = `[MODE: PLAN — STRATEGIC ANALYSIS]\nYou are in PLAN mode. Analyze the current state, propose architectural decisions, create detailed implementation plans, and outline steps. Do NOT implement any code or modify any files. Focus on structure, trade-offs, and sequencing.\n\n${agentPrompt}`;
            break;
        // craft: use unchanged agent prompt (full editing capability)
    }
    // Determine model config
    const mc = modelConfig ?? session.modelConfig;
    const runtimeConfig = await buildRuntimeConfig(mc.provider);
    if (!runtimeConfig) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `No API key configured for ${mc.provider}` }));
        return;
    }
    // ── Build user message with images ──
    let userContent = message;
    if (images && images.length > 0) {
        userContent += '\n\n[附带的图片 / Attached images:]\n';
        for (let i = 0; i < images.length; i++) {
            userContent += `\n![image-${i + 1}](data:image/png;base64,${images[i]?.slice(0, 200) ?? ''}...)`;
        }
    }
    // Append user message (store original message text, images in content)
    addMessage(session, 'user', userContent);
    const sse = createSSEStream(res);
    // Notify client of session info
    sse.send('status', { type: 'start', sessionId: session.id, agent, mode });
    try {
        // Build messages (use mode-augmented prompt)
        const messages = [
            { role: 'system', content: augmentedPrompt, timestamp: new Date().toISOString() },
        ];
        if (session.context?.injectedContent) {
            messages.push({
                role: 'user',
                content: `[上下文文件]\n${session.context.injectedContent.slice(0, 50000)}`,
                timestamp: new Date().toISOString(),
                isContext: true,
            });
        }
        for (const msg of session.messages.slice(-20)) {
            messages.push({ role: msg.role, content: msg.content, timestamp: msg.timestamp });
        }
        const response = await callLLM(runtimeConfig, {
            model: mc.model,
            messages: messages,
            maxTokens: mc.maxTokens ?? 4096,
            temperature: mc.temperature ?? 0.7,
        });
        // Stream text content (simulate streaming for non-streaming responses)
        const text = response.content || '';
        const chunks = text.match(/.{1,200}/g) ?? [text];
        for (const chunk of chunks) {
            if (chunk)
                sse.send('text', { content: chunk });
            // Yield to event loop without unnecessary delay
            await new Promise((r) => setTimeout(r, 0));
        }
        // Usage
        if (response.usage) {
            const cost = calculateCost(response.model, response.usage.promptTokens, response.usage.completionTokens);
            sse.send('usage', {
                promptTokens: response.usage.promptTokens,
                completionTokens: response.usage.completionTokens,
                cost,
            });
            await recordUsage({
                timestamp: new Date().toISOString(),
                agent,
                provider: mc.provider,
                model: response.model,
                promptTokens: response.usage.promptTokens,
                completionTokens: response.usage.completionTokens,
                cost,
            });
            // Budget check
            const budget = await checkBudget();
            if (budget.warned) {
                sse.send('warning', { message: formatBudgetWarning(budget.totalSpent) });
            }
        }
        // Append assistant message
        addMessage(session, 'assistant', text);
        await save(session);
        sse.send('done', { sessionId: session.id, messageCount: session.messages.length });
    }
    catch (err) {
        // Try Ollama fallback
        let fallbackTried = false;
        if (err instanceof LlmError && (err.status === 0 || err.status >= 500)) {
            if (await detectOllama()) {
                await registerOllamaProvider();
                try {
                    const messages = [
                        { role: 'system', content: agentPrompt, timestamp: new Date().toISOString() },
                    ];
                    for (const msg of session.messages.slice(-20)) {
                        messages.push({ role: msg.role, content: msg.content, timestamp: msg.timestamp });
                    }
                    const fallback = await callOllama('llama3.1', {
                        model: 'llama3.1',
                        messages: messages,
                        maxTokens: mc.maxTokens ?? 4096,
                        temperature: mc.temperature ?? 0.7,
                    });
                    sse.send('text', { content: fallback.content });
                    addMessage(session, 'assistant', fallback.content);
                    await save(session);
                    sse.send('done', { sessionId: session.id, messageCount: session.messages.length, fallback: 'ollama' });
                    return;
                }
                catch {
                    fallbackTried = true;
                }
            }
        }
        sse.error(err instanceof LlmError ? err.status : 500, err instanceof Error ? err.message : 'Unknown error');
    }
}
//# sourceMappingURL=chat.js.map