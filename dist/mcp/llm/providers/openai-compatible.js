/**
 * OpenAI-Compatible Provider
 *
 * Implements the OpenAI Chat Completions API.
 * Also serves as the base for DeepSeek, Kimi, and other OpenAI-compatible endpoints.
 */
import { BaseLLMProvider } from './base.js';
import { PROVIDER_DEFAULTS } from '../types.js';
import { McpErrorCode, mcpError } from '../../errors.js';
export class OpenAICompatibleProvider extends BaseLLMProvider {
    providerName = 'openai-compatible';
    /** Safely parse JSON; return empty object on failure instead of throwing */
    safeParseJson(json) {
        try {
            return JSON.parse(json);
        }
        catch {
            return {};
        }
    }
    formatTools(tools) {
        return tools.map(t => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: {
                    type: 'object',
                    properties: t.input_schema.properties ?? {},
                    required: t.input_schema.required ?? [],
                },
            },
        }));
    }
    formatMessages(messages) {
        return messages.map(m => {
            if (m.role === 'tool') {
                return {
                    role: 'tool',
                    tool_call_id: m.tool_call_id ?? '',
                    content: m.content,
                };
            }
            return {
                role: m.role,
                content: m.content,
                ...(m.name ? { name: m.name } : {}),
            };
        });
    }
    async call(req, config, endpoint) {
        const baseUrl = endpoint.baseUrl ?? PROVIDER_DEFAULTS['openai-compatible']?.baseUrl ?? 'https://api.openai.com/v1';
        const apiKey = config.api_key;
        const body = {
            model: config.model,
            messages: this.formatMessages(req.messages),
            max_tokens: config.max_tokens ?? 4096,
            temperature: config.temperature ?? 0.7,
        };
        if (req.tools && req.tools.length > 0) {
            body.tools = this.formatTools(req.tools);
            body.tool_choice = 'auto';
        }
        if (req.stop_sequences && req.stop_sequences.length > 0) {
            body.stop = req.stop_sequences;
        }
        const response = await this.fetchWithRetry(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                ...this.buildHeaders(config, endpoint),
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
        }, 60000);
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            if (response.status === 401 || response.status === 403) {
                throw mcpError(McpErrorCode.LLM_AUTH_FAILED, `OpenAI auth failed: ${response.status}`);
            }
            if (response.status === 429) {
                throw mcpError(McpErrorCode.LLM_RATE_LIMITED, 'OpenAI rate limited');
            }
            throw mcpError(McpErrorCode.INTERNAL_ERROR, `OpenAI API error: ${response.status} - ${errorText}`);
        }
        const data = (await response.json());
        const choice = data.choices[0];
        if (!choice) {
            throw mcpError(McpErrorCode.INTERNAL_ERROR, 'OpenAI returned empty choices');
        }
        // Extract tool calls
        let toolCalls;
        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
            toolCalls = choice.message.tool_calls.map(tc => ({
                id: tc.id,
                name: tc.function.name,
                arguments: this.safeParseJson(tc.function.arguments),
            }));
        }
        const usage = {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens,
            cost_estimate: this.estimateCost(config.model, {
                prompt_tokens: data.usage.prompt_tokens,
                completion_tokens: data.usage.completion_tokens,
            }),
        };
        return {
            content: choice.message.content,
            tool_calls: toolCalls,
            usage,
            raw: data,
            provider: this.providerName,
        };
    }
}
//# sourceMappingURL=openai-compatible.js.map