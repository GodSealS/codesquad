/**
 * Generic LLM API client.
 *
 * Routes requests through the appropriate provider protocol
 * (Anthropic native, OpenAI, or OpenAI-compatible).
 * Phase 1.4 — Step 1.4.1 base.
 */
// ── Protocols ──
async function callAnthropic(provider, request) {
    const body = {
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
        messages: request.messages
            .filter((m) => m.role !== 'system')
            .map((m) => {
            const msg = { role: m.role, content: m.content };
            // Support native tool_calls in assistant messages
            if (m.tool_calls)
                msg.tool_calls = m.tool_calls;
            return msg;
        }),
    };
    // Streaming: Anthropic expects "stream": true in the body for SSE
    if (request.stream) {
        body.stream = true;
    }
    // Feature 4 (P4): Prompt caching — use structured ContentBlock[] for system
    if (request.systemContentBlocks && request.systemContentBlocks.length > 0) {
        // Last static block gets cache_control breakpoint
        const blocks = [...request.systemContentBlocks];
        body.system = blocks;
    }
    else {
        // Fallback: join system messages into plain string (backward compat)
        // B7 fix: don't send empty system string — Anthropic API rejects it
        const systemStr = request.messages
            .filter((m) => m.role === 'system')
            .map((m) => m.content)
            .join('\n\n');
        if (systemStr)
            body.system = systemStr;
    }
    // Feature 1: Native tool_use support (P4)
    if (request.tools && request.tools.length > 0) {
        body.tools = request.tools;
        body.tool_choice = request.tool_choice || { type: 'auto' };
    }
    // Thinking mode (Anthropic extended thinking)
    if (request.thinkingMode && request.thinkingMode !== 'fast') {
        const budgetTokens = request.thinkingMode === 'deep' ? 16000 : 4000;
        body.thinking = { type: 'enabled', budget_tokens: budgetTokens };
        // Ensure max_tokens > budget_tokens (required by Anthropic)
        body.max_tokens = Math.max(body.max_tokens || 4096, budgetTokens + 2048);
    }
    return fetch(`${provider.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': provider.apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: request.signal,
    });
}
async function callOpenAI(provider, request) {
    const body = {
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
        messages: [
            // S04: Inject systemContentBlocks as system role messages for OpenAI-compatible APIs.
            // Anthropic uses a separate "system" field, but OpenAI/DeepSeek expect system as a
            // { role: 'system', content: '...' } message in the messages array.
            // Without this, the language instruction and agent system prompt are silently dropped.
            ...(request.systemContentBlocks && request.systemContentBlocks.length > 0
                ? request.systemContentBlocks.map((b) => ({ role: 'system', content: b.text }))
                : []),
            ...request.messages.map((m) => {
                const msg = { role: m.role, content: m.content };
                // Support native tool_calls in assistant messages (for conversation continuity)
                if (m.tool_calls)
                    msg.tool_calls = m.tool_calls;
                return msg;
            }),
        ],
    };
    // Streaming: OpenAI expects "stream": true in the body for SSE
    if (request.stream) {
        body.stream = true;
    }
    // Feature 1: Native function calling support (P4)
    if (request.tools && request.tools.length > 0) {
        body.tools = request.tools.map((t) => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.input_schema,
            },
        }));
        // Map Anthropic tool_choice values to OpenAI-compatible ones:
        //   'auto' → 'auto', 'any'/'tool' → 'required'
        const openaiToolChoiceMap = { auto: 'auto', any: 'required', tool: 'required' };
        body.tool_choice = openaiToolChoiceMap[request.tool_choice?.type || 'auto'] || 'auto';
    }
    // Thinking mode (OpenAI / DeepSeek reasoning_effort)
    if (request.thinkingMode && request.thinkingMode !== 'fast') {
        const effortMap = { think: 'medium', deep: 'high' };
        body.reasoning_effort = effortMap[request.thinkingMode] || 'medium';
        // Also add 'thinking' param for DeepSeek API compatibility
        if (request.thinkingMode === 'deep') {
            body.thinking = { type: 'enabled' };
        }
    }
    return fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: request.signal,
    });
}
// ── Error handling ──
export class LlmError extends Error {
    status;
    providerId;
    constructor(message, status, providerId) {
        super(message);
        this.status = status;
        this.providerId = providerId;
        this.name = 'LlmError';
    }
}
/** Maps HTTP status codes to human-readable Chinese annotations. */
const STATUS_NOTE = {
    400: '请求参数错误',
    401: 'Key 无效或已过期',
    402: '余额不足',
    403: '账户权限不足或欠费',
    404: '模型不存在',
    429: '请求频率过高，30s 后自动重试',
    500: '服务器内部错误',
    502: '上游服务异常',
    503: '服务暂时不可用',
};
function formatError(status, providerName) {
    const note = STATUS_NOTE[status];
    if (note) {
        return `API 错误 ${status}（${note}）from ${providerName}`;
    }
    return `API 错误 ${status} from ${providerName}`;
}
// ── Main client ──
// S01: default LLM timeout (prevents permanent hang on network stall)
const DEFAULT_LLM_TIMEOUT_MS = 60_000;
export async function callLLM(provider, request) {
    // S01: enforce default timeout if caller didn't provide a signal
    const requestWithTimeout = {
        ...request,
        signal: request.signal ?? AbortSignal.timeout(DEFAULT_LLM_TIMEOUT_MS),
    };
    let response;
    try {
        if (provider.protocol === 'anthropic') {
            response = await callAnthropic(provider, { ...requestWithTimeout, stream: false });
        }
        else {
            response = await callOpenAI(provider, { ...requestWithTimeout, stream: false });
        }
    }
    catch (err) {
        const error = err;
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            throw new LlmError(`请求超时 (${DEFAULT_LLM_TIMEOUT_MS / 1000}s)`, 0, provider.id);
        }
        if (error.code === 'ECONNREFUSED') {
            throw new LlmError(`无法连接到 ${provider.name} — 检查网络 / 尝试离线模式`, 0, provider.id);
        }
        if (error.code === 'ETIMEDOUT') {
            throw new LlmError(`请求超时 — 正在重试`, 0, provider.id);
        }
        throw new LlmError(error.message || `Request failed for ${provider.name}`, 0, provider.id);
    }
    if (!response.ok) {
        throw new LlmError(formatError(response.status, provider.name), response.status, provider.id);
    }
    if (provider.protocol === 'anthropic') {
        let json;
        try {
            json = await response.json();
        }
        catch {
            throw new LlmError(`Invalid JSON response from ${provider.name}`, response.status, provider.id);
        }
        const data = json;
        // Feature 1: Extract native tool_use blocks
        const toolCalls = [];
        const textParts = [];
        if (data.content) {
            for (const block of data.content) {
                if (block.type === 'tool_use' && block.name) {
                    toolCalls.push({
                        id: block.id || `toolu_${block.name}`,
                        name: block.name,
                        input: block.input || {},
                    });
                }
                else if (block.type === 'text' && block.text) {
                    textParts.push(block.text);
                }
            }
        }
        return {
            content: textParts.join(''),
            model: data.model,
            usage: data.usage
                ? {
                    promptTokens: data.usage.input_tokens,
                    completionTokens: data.usage.output_tokens,
                    totalTokens: data.usage.input_tokens + data.usage.output_tokens,
                    cacheCreationTokens: data.usage.cache_creation_input_tokens ?? 0,
                    cacheReadTokens: data.usage.cache_read_input_tokens ?? 0,
                }
                : undefined,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        };
    }
    // OpenAI / OpenAI-compatible
    let json;
    try {
        json = await response.json();
    }
    catch {
        throw new LlmError(`Invalid JSON response from ${provider.name}`, response.status, provider.id);
    }
    const data = json;
    const choice = data.choices?.[0];
    // Feature 1: Extract native function calls (OpenAI format)
    const toolCalls = [];
    if (choice?.message?.tool_calls) {
        for (const tc of choice.message.tool_calls) {
            let input = {};
            try {
                input = JSON.parse(tc.function.arguments);
            }
            catch {
                // S12: log malformed JSON but continue with raw string
                console.warn(`[client] Failed to parse OpenAI tool arguments for ${tc.function.name}`);
            }
            toolCalls.push({ id: tc.id, name: tc.function.name, input });
        }
    }
    return {
        content: choice?.message?.content ?? '',
        model: data.model,
        usage: data.usage
            ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            }
            : undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
}
/**
 * Call LLM with streaming — yields tokens as they arrive.
 * Mirrors Claude Code's streaming UX for progressive output.
 *
 * Usage:
 *   for await (const event of callLLMStream(provider, request)) {
 *     if (event.type === 'token') process.stdout.write(event.text!);
 *     if (event.type === 'done') console.log(event.response);
 *   }
 */
export async function* callLLMStream(provider, request) {
    let response;
    try {
        if (provider.protocol === 'anthropic') {
            response = await callAnthropic(provider, { ...request, stream: true });
        }
        else {
            response = await callOpenAI(provider, { ...request, stream: true });
        }
    }
    catch (err) {
        const error = err;
        yield { type: 'error', error: error.message || 'Connection failed' };
        return;
    }
    if (!response.ok) {
        yield {
            type: 'error',
            error: formatError(response.status, provider.name),
        };
        return;
    }
    if (!response.body) {
        yield { type: 'error', error: 'No response body (streaming not supported)' };
        return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';
    let accumulatedThinking = '';
    let modelName = request.model;
    let usageInfo;
    // Feature 1: Track tool_use blocks in streaming (Anthropic)
    const toolUseBlocks = new Map();
    // Feature 1: Track OpenAI tool_calls in streaming
    const openaiToolCalls = new Map();
    // Thinking: track Anthropic thinking blocks
    const thinkingBlocks = new Map();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // keep incomplete line
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: '))
                    continue;
                const jsonStr = trimmed.slice(6); // strip "data: "
                if (jsonStr === '[DONE]')
                    continue;
                try {
                    const chunk = JSON.parse(jsonStr);
                    if (provider.protocol === 'anthropic') {
                        // content_block_start: new block appearing (could be thinking or tool_use)
                        if (chunk.type === 'content_block_start') {
                            const block = chunk.content_block;
                            if (block?.type === 'tool_use') {
                                toolUseBlocks.set(chunk.index, {
                                    id: block.id,
                                    name: block.name,
                                    inputJson: '',
                                });
                            }
                            if (block?.type === 'thinking') {
                                thinkingBlocks.set(chunk.index, '');
                            }
                        }
                        // content_block_delta: text, thinking_delta, or tool input delta
                        if (chunk.type === 'content_block_delta') {
                            if (chunk.delta?.type === 'text_delta' && chunk.delta?.text) {
                                accumulated += chunk.delta.text;
                                yield { type: 'token', text: accumulated };
                            }
                            if (chunk.delta?.type === 'thinking_delta' && chunk.delta?.thinking) {
                                const existing = thinkingBlocks.get(chunk.index) || '';
                                thinkingBlocks.set(chunk.index, existing + chunk.delta.thinking);
                                accumulatedThinking += chunk.delta.thinking;
                                yield { type: 'thinking', thinking: accumulatedThinking };
                            }
                            if (chunk.delta?.type === 'signature_delta') {
                                // Redacted thinking signature — skip
                            }
                            if (chunk.delta?.type === 'input_json_delta' && chunk.delta?.partial_json) {
                                const block = toolUseBlocks.get(chunk.index);
                                if (block)
                                    block.inputJson += chunk.delta.partial_json;
                            }
                        }
                        if (chunk.type === 'message_delta') {
                            modelName = chunk.model || modelName;
                            if (chunk.usage) {
                                usageInfo = {
                                    promptTokens: chunk.usage.input_tokens || 0,
                                    completionTokens: chunk.usage.output_tokens || 0,
                                    totalTokens: (chunk.usage.input_tokens || 0) + (chunk.usage.output_tokens || 0),
                                };
                            }
                        }
                        if (chunk.type === 'message_stop') {
                            // stream complete
                        }
                    }
                    else {
                        // OpenAI SSE format: { choices: [{ delta: { content: "...", tool_calls: [...] } }] }
                        const delta = chunk.choices?.[0]?.delta;
                        // Reasoning/thinking content (DeepSeek R1, OpenAI o1)
                        if (delta?.reasoning_content) {
                            accumulatedThinking += delta.reasoning_content;
                            yield { type: 'thinking', thinking: accumulatedThinking };
                        }
                        // Text content
                        if (delta?.content) {
                            accumulated += delta.content;
                            yield { type: 'token', text: accumulated };
                        }
                        // Tool calls (streaming function calls)
                        // Mirrors Anthropic content_block_start/delta pattern: track incremental tool_calls
                        if (delta?.tool_calls) {
                            for (const tc of delta.tool_calls) {
                                const existing = openaiToolCalls.get(tc.index) || { id: '', name: '', arguments: '' };
                                if (tc.id)
                                    existing.id = tc.id;
                                if (tc.function?.name)
                                    existing.name = tc.function.name;
                                if (tc.function?.arguments)
                                    existing.arguments += tc.function.arguments;
                                openaiToolCalls.set(tc.index, existing);
                            }
                        }
                        if (chunk.choices?.[0]?.finish_reason) {
                            modelName = chunk.model || modelName;
                            if (chunk.usage) {
                                usageInfo = {
                                    promptTokens: chunk.usage.prompt_tokens || 0,
                                    completionTokens: chunk.usage.completion_tokens || 0,
                                    totalTokens: chunk.usage.total_tokens || 0,
                                };
                            }
                        }
                    }
                }
                catch {
                    // S12: skip malformed SSE chunks (debug level — high volume)
                }
            }
        }
        // Feature 1: Parse tool_use blocks from streaming (Anthropic + OpenAI)
        const toolCalls = [];
        // Anthropic tool_use blocks
        for (const [, block] of toolUseBlocks) {
            if (block.name) {
                let input = {};
                try {
                    input = JSON.parse(block.inputJson);
                }
                catch { /* partial */ }
                toolCalls.push({ id: block.id || '', name: block.name, input });
            }
        }
        // OpenAI function calls from streaming
        for (const [, tc] of openaiToolCalls) {
            if (tc.name) {
                let input = {};
                try {
                    input = JSON.parse(tc.arguments);
                }
                catch { /* partial */ }
                toolCalls.push({ id: tc.id || '', name: tc.name, input });
            }
        }
        // Stream complete — yield final response
        yield {
            type: 'done',
            text: accumulated,
            response: {
                content: accumulated,
                model: modelName,
                usage: usageInfo,
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            },
        };
    }
    catch (err) {
        yield { type: 'error', error: err.message };
        try {
            reader.cancel();
        }
        catch { /* already closed */ }
    }
    finally {
        try {
            reader.releaseLock();
        }
        catch { /* already released */ }
    }
}
//# sourceMappingURL=client.js.map