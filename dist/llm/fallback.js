/**
 * Offline fallback — detects local Ollama and auto-switches when network is down.
 * Phase 1.6 — Step 1.6.4.
 */
import { registerProvider } from './registry.js';
// ── Detect Ollama ──
let _ollamaAvailable = null;
export async function detectOllama() {
    if (_ollamaAvailable !== null)
        return _ollamaAvailable;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch('http://localhost:11434/api/tags', {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        _ollamaAvailable = res.ok;
        return _ollamaAvailable;
    }
    catch {
        _ollamaAvailable = false;
        return false;
    }
}
// ── List Ollama models ──
export async function listOllamaModels() {
    try {
        const res = await fetch('http://localhost:11434/api/tags');
        const data = (await res.json());
        return data.models?.map((m) => m.name) ?? [];
    }
    catch {
        return [];
    }
}
// ── Call Ollama ──
export async function callOllama(model, request) {
    const res = await fetch('http://localhost:11434/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
            max_tokens: request.maxTokens ?? 4096,
            temperature: request.temperature ?? 0.7,
        }),
    });
    if (!res.ok) {
        throw new Error(`Ollama API error: ${res.status}`);
    }
    const data = (await res.json());
    return {
        content: data.choices?.[0]?.message?.content ?? '',
        model: data.model,
        usage: data.usage
            ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            }
            : undefined,
    };
}
// ── Auto-register Ollama as provider ──
export async function registerOllamaProvider() {
    if (!(await detectOllama()))
        return;
    const models = await listOllamaModels();
    if (models.length === 0) {
        console.error('[Ollama] Ollama is running but no models found. Pull a model first, e.g.: ollama pull qwen2.5:3b');
        return;
    }
    const defaultModel = models[0];
    const ollamaProvider = {
        id: 'ollama',
        name: 'Ollama Local',
        protocol: 'openai-compatible',
        baseUrl: 'http://localhost:11434/v1',
        models,
        defaultModel,
        envVar: '', // Ollama doesn't need an API key
    };
    registerProvider(ollamaProvider);
}
//# sourceMappingURL=fallback.js.map