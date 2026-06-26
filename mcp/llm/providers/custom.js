/**
 * Custom LLM Provider
 *
 * OpenAI-compatible provider for third-party / self-hosted endpoints.
 * Supports any service that implements OpenAI-compatible chat completions API.
 *
 * Examples: vLLM, Ollama, LocalAI, LiteLLM proxy, self-hosted deployment
 */
import { BaseLLMProvider } from './base.js';
import { McpErrorCode, mcpError } from '../../errors.js';
import { logger } from '../../observability/logger.js';
/** Custom provider implementing OpenAI-compatible API */
export class CustomProvider extends BaseLLMProvider {
    providerName = 'custom';
    async call(req, config, endpoint) {
        const baseUrl = config.base_url ?? endpoint.baseUrl;
        if (!baseUrl) {
            throw mcpError(McpErrorCode.INVALID_INPUT, 'Custom provider requires base_url in model_config');
        }
        // Resolve API key via Authorization header or apiKey
        const apiKey = this.resolveKey(config, endpoint);
        const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
        const headers = {
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        // Merge endpoint and caller custom headers
        if (endpoint.headers)
            Object.assign(headers, endpoint.headers);
        if (config.headers)
            Object.assign(headers, config.headers);
        // Build OpenAI-compatible request body
        const body = {
            model: config.model,
            messages: req.messages.map(m => ({
                role: m.role === 'tool' ? 'tool' : m.role,
                content: m.content,
                ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
                ...(m.name ? { name: m.name } : {}),
            })),
            max_tokens: config.max_tokens ?? req.max_tokens ?? 4096,
            temperature: config.temperature ?? req.temperature ?? 0.7,
        };
        // Add tools if provided
        if (req.tools && req.tools.length > 0) {
            body['tools'] = this.formatTools(req.tools);
        }
        // Add stop sequences if provided
        if (req.stop_sequences && req.stop_sequences.length > 0) {
            body['stop'] = req.stop_sequences;
        }
        const timeout = 120_000; // Default 2 min timeout for custom endpoints
        logger.debug(`Custom LLM call: ${config.model} -> ${url}`, 'llm:custom', {
            model: config.model,
            messages: req.messages.length,
            tools: req.tools?.length ?? 0,
        });
        const response = await this.fetchWithRetry(url, { method: 'POST', headers, body: JSON.stringify(body) }, timeout);
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            logger.error(`Custom LLM error ${response.status}: ${errorText}`, 'llm:custom', {
                status: response.status,
                error: errorText.slice(0, 500),
            });
            throw mcpError(response.status === 401 || response.status === 403
                ? McpErrorCode.LLM_AUTH_FAILED
                : McpErrorCode.INTERNAL_ERROR, `Custom provider returned ${response.status}: ${errorText.slice(0, 300)}`, { status: response.status });
        }
        const data = await response.json();
        // Extract usage
        const usageData = (data['usage'] ?? {});
        const usage = {
            prompt_tokens: usageData['prompt_tokens'] ?? 0,
            completion_tokens: usageData['completion_tokens'] ?? 0,
            total_tokens: usageData['total_tokens'] ?? 0,
            cost_estimate: this.estimateCost(config.model, {
                prompt_tokens: usageData['prompt_tokens'] ?? 0,
                completion_tokens: usageData['completion_tokens'] ?? 0,
            }),
        };
        // Extract message
        const choices = (data['choices'] ?? []);
        const choice = choices[0];
        const message = (choice?.['message'] ?? {});
        // Parse tool calls
        const toolCalls = [];
        if (message['tool_calls']) {
            for (const tc of message['tool_calls']) {
                const tcId = (tc['id'] ?? '');
                const tcFn = (tc['function'] ?? {});
                let args = {};
                if (typeof tcFn['arguments'] === 'string') {
                    try {
                        args = JSON.parse(tcFn['arguments']);
                    }
                    catch { /* invalid JSON, use empty */ }
                }
                toolCalls.push({
                    id: tcId,
                    name: (tcFn['name'] ?? ''),
                    arguments: args,
                });
            }
        }
        return {
            content: message['content'] ?? null,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
            usage,
            provider: 'custom',
            raw: data,
        };
    }
    /** Format tools to OpenAI-compatible schema */
    formatTools(tools) {
        return tools.map(tool => {
            const props = (tool.input_schema?.['properties'] ?? {});
            const required = (tool.input_schema?.['required'] ?? []);
            return {
                type: 'function',
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: {
                        type: 'object',
                        properties: Object.fromEntries(Object.entries(props).map(([name, def]) => {
                            const d = def;
                            return [name, {
                                    type: d['type'] ?? 'string',
                                    description: d['description'] ?? '',
                                    ...(d['enum'] ? { enum: d['enum'] } : {}),
                                }];
                        })),
                        required: required.length > 0 ? required : undefined,
                    },
                },
            };
        });
    }
    /** Resolve API key from various sources */
    resolveKey(config, endpoint) {
        // 1. Direct api_key
        if (config.api_key)
            return config.api_key;
        // 2. Authorization header
        if (config.headers?.['Authorization']) {
            const auth = config.headers['Authorization'];
            if (typeof auth === 'string') {
                return auth.replace(/^Bearer\s+/i, '');
            }
        }
        // 3. Endpoint headers
        if (endpoint.headers?.['Authorization']) {
            const auth = endpoint.headers['Authorization'];
            if (typeof auth === 'string') {
                return auth.replace(/^Bearer\s+/i, '');
            }
        }
        // 4. Endpoint apiKey field
        if (endpoint.apiKey)
            return endpoint.apiKey;
        return null;
    }
}
//# sourceMappingURL=custom.js.map