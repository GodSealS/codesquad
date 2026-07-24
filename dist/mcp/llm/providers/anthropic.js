/**
 * Anthropic Provider
 *
 * Implements the Anthropic Messages API.
 * Maps generic LLM requests to Anthropic-specific formats.
 */
import { BaseLLMProvider } from './base.js';
import { PROVIDER_DEFAULTS } from '../types.js';
import { McpErrorCode, mcpError } from '../../errors.js';
export class AnthropicProvider extends BaseLLMProvider {
    providerName = 'anthropic';
    formatTools(tools) {
        return tools.map(t => ({
            name: t.name,
            description: t.description,
            input_schema: {
                type: 'object',
                properties: t.input_schema.properties ?? {},
                required: t.input_schema.required ?? [],
            },
        }));
    }
    formatMessages(messages) {
        return messages.map(m => ({
            role: m.role === 'tool' ? 'user' : m.role,
            content: m.content,
            ...(m.tool_call_id
                ? {
                    content: [
                        {
                            type: 'tool_result',
                            tool_use_id: m.tool_call_id,
                            content: m.content,
                        },
                    ],
                }
                : {}),
        }));
    }
    async call(req, config, endpoint) {
        const baseUrl = endpoint.baseUrl ?? PROVIDER_DEFAULTS['anthropic']?.baseUrl ?? 'https://api.anthropic.com';
        const apiKey = config.api_key;
        const body = {
            model: config.model,
            messages: this.formatMessages(req.messages),
            max_tokens: config.max_tokens ?? 4096,
            temperature: config.temperature ?? 0.7,
        };
        if (req.tools && req.tools.length > 0) {
            body.tools = this.formatTools(req.tools);
        }
        if (req.stop_sequences && req.stop_sequences.length > 0) {
            body.stop_sequences = req.stop_sequences;
        }
        const response = await this.fetchWithRetry(`${baseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                ...this.buildHeaders(config, endpoint),
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(body),
        }, 60000);
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            if (response.status === 401 || response.status === 403) {
                throw mcpError(McpErrorCode.LLM_AUTH_FAILED, `Anthropic auth failed: ${response.status}`);
            }
            if (response.status === 429) {
                throw mcpError(McpErrorCode.LLM_RATE_LIMITED, 'Anthropic rate limited');
            }
            throw mcpError(McpErrorCode.INTERNAL_ERROR, `Anthropic API error: ${response.status} - ${errorText}`);
        }
        const data = (await response.json());
        // Extract text content and tool calls
        let textContent = null;
        const toolCalls = [];
        for (const block of data.content) {
            if (block.type === 'text') {
                textContent = (textContent ?? '') + block.text;
            }
            else if (block.type === 'tool_use') {
                toolCalls.push({
                    id: block.id,
                    name: block.name,
                    arguments: block.input,
                });
            }
        }
        const usage = {
            prompt_tokens: data.usage.input_tokens,
            completion_tokens: data.usage.output_tokens,
            total_tokens: data.usage.input_tokens + data.usage.output_tokens,
            cost_estimate: this.estimateCost(config.model, {
                prompt_tokens: data.usage.input_tokens,
                completion_tokens: data.usage.output_tokens,
            }),
            cache_creation_input_tokens: data.usage.cache_creation_input_tokens ?? 0,
            cache_read_input_tokens: data.usage.cache_read_input_tokens ?? 0,
        };
        return {
            content: textContent,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
            usage,
            raw: data,
            provider: this.providerName,
        };
    }
}
//# sourceMappingURL=anthropic.js.map