/**
 * Session Memory — background extraction of conversation summaries.
 *
 * Monitors token usage and tool calls during a REPL session.
 * When thresholds are met, extracts a concise summary to session-memory.md.
 * Used by memory-compact for context-aware conversation truncation.
 *
 * Triple guard:
 *   1. Only triggers on repl_main_thread (querySource check)
 *   2. Only triggers when autoCompact is enabled
 *   3. Fork recursion prevention via extraction-in-progress flag
 *
 * References:
 *   Claude Code src/services/SessionMemory/sessionMemory.ts
 *   Idea/tutrue/memory-system-design.md §2.3.3
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
// ── Configuration ──
/** Default config — aligned with Claude Code. */
export const DEFAULT_SESSION_MEMORY_CONFIG = {
    minimumMessageTokensToInit: 10000,
    minimumTokensBetweenUpdate: 5000,
    toolCallsBetweenUpdates: 3,
};
const _state = new Map();
// ── Token estimation ──
function estimateTokens(messages) {
    let total = 0;
    for (const msg of messages) {
        total += (msg.content?.length ?? 0) / 4; // rough estimate: ~4 chars per token
    }
    return Math.round(total);
}
// ── Path helpers ──
function sessionMemoryPath(sessionId, projectRoot) {
    const dir = join(projectRoot, '.codesquad', 'session-memory');
    mkdirSync(dir, { recursive: true });
    return join(dir, `${sessionId}.md`);
}
/** Default local Qwen model name. */
const LOCAL_QWEN_MODEL = 'qwen2.5:3b';
/** Detect if a local Ollama server is running and Qwen 2.5 is available. */
async function isLocalQwenAvailable() {
    try {
        const resp = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
        if (!resp.ok)
            return false;
        const data = (await resp.json());
        return (data.models ?? []).some((m) => m.name.startsWith('qwen2.5'));
    }
    catch {
        return false;
    }
}
/**
 * Resolve the effective extractor based on mode setting and local availability.
 */
export async function resolveSideQueryConfig(mode, defaultProvider) {
    // null → use regex extraction
    switch (mode) {
        case 'local-model': {
            const available = await isLocalQwenAvailable();
            if (available) {
                return {
                    provider: {
                        id: 'ollama',
                        name: 'Ollama (Local)',
                        protocol: 'openai-compatible',
                        baseUrl: 'http://localhost:11434/v1',
                        models: [LOCAL_QWEN_MODEL],
                        defaultModel: LOCAL_QWEN_MODEL,
                        envVar: 'NONE',
                        apiKey: 'ollama',
                    },
                    model: LOCAL_QWEN_MODEL,
                };
            }
            // Qwen not available → fall through to regex
            return null;
        }
        case 'online-model':
            return { provider: defaultProvider, model: 'deepseek-v4-flash' };
        case 'regex':
        default:
            return null; // Use regex extraction
    }
}
// ── Regex Template Extraction (Scheme B) ──
const KEY_PATTERNS = [
    { label: 'Decision', pattern: /决定[：:]\s*(.+)$|采用\s*(.+)$|选定\s*(.+)$/im },
    { label: 'Fact', pattern: /确认[：:]\s*(.+)$|明确[：:]\s*(.+)$/im },
    { label: 'Constraint', pattern: /限制[：:]\s*(.+)$|不能\s*(.+)$|禁止\s*(.+)$/im },
    { label: 'Action', pattern: /TODO[：:]\s*(.+)$|待办[：:]\s*(.+)$|下一步[：:]\s*(.+)$/im },
];
/**
 * Extract structured key points from conversation using regex patterns.
 * (Scheme B — template matching)
 */
export function extractViaRegex(messages) {
    const lines = [];
    let hasContent = false;
    for (const msg of messages) {
        const content = msg.content ?? '';
        for (const pat of KEY_PATTERNS) {
            const match = content.match(pat.pattern);
            if (match) {
                const value = (match[1] ?? match[2] ?? match[3] ?? '').trim();
                if (value.length > 0) {
                    lines.push(`- [${pat.label}] ${value}`);
                    hasContent = true;
                }
            }
        }
    }
    // Fallback: last 2 assistant messages as context
    const assistantMsgs = messages.filter((m) => m.role === 'assistant' && (m.content ?? '').length > 30);
    const lastAssistants = assistantMsgs.slice(-2);
    if (!hasContent && lastAssistants.length === 0) {
        // Ultimate fallback: last 5 messages text
        return messages.slice(-5).map((m) => `[${m.role}]: ${(m.content ?? '').slice(0, 150)}`).join('\n\n');
    }
    if (!hasContent) {
        return lastAssistants.map((m) => `- ${(m.content ?? '').slice(0, 300)}`).join('\n\n');
    }
    return lines.join('\n');
}
// ── API ──
/** Initialize session memory tracking for a session. */
export function initSessionMemory(sessionId) {
    _state.set(sessionId, {
        lastExtractionTokens: 0,
        toolCallCount: 0,
        extracting: false,
        extracted: false,
    });
}
/**
 * Check if session memory extraction should trigger.
 * @param sessionId - Current session ID
 * @param messages - All messages in the conversation
 * @param querySource - Source identifier (only 'repl_main_thread' triggers)
 * @param autoCompactEnabled - Whether auto-compact is enabled
 * @param config - Threshold configuration (defaults to Claude Code values)
 */
export function shouldExtractMemory(sessionId, messages, querySource, autoCompactEnabled, config = DEFAULT_SESSION_MEMORY_CONFIG) {
    // Guard 1: only main REPL thread
    if (querySource !== 'repl_main_thread')
        return false;
    // Guard 2: auto-compact must be enabled
    if (!autoCompactEnabled)
        return false;
    // Guard 3: re-entrancy prevention
    const state = _state.get(sessionId);
    if (!state)
        return false;
    if (state.extracting)
        return false;
    const currentTokens = estimateTokens(messages);
    // First extraction: token threshold
    if (!state.extracted) {
        if (currentTokens >= config.minimumMessageTokensToInit) {
            return true;
        }
        return false;
    }
    // Subsequent extractions: token growth + tool calls
    const tokenGrowth = currentTokens - state.lastExtractionTokens;
    if (tokenGrowth >= config.minimumTokensBetweenUpdate &&
        state.toolCallCount >= config.toolCallsBetweenUpdates) {
        return true;
    }
    return false;
}
/**
 * Record a tool call for session memory tracking.
 */
export function recordToolCall(sessionId) {
    const state = _state.get(sessionId);
    if (state)
        state.toolCallCount++;
}
/**
 * Mark extraction start (sets re-entrancy guard).
 */
export function markExtractionStarted(sessionId) {
    const state = _state.get(sessionId);
    if (state)
        state.extracting = true;
}
/**
 * Mark extraction complete and update token baseline.
 */
export function markExtractionCompleted(sessionId, messageCount) {
    const state = _state.get(sessionId);
    if (!state)
        return;
    state.extracting = false;
    state.extracted = true;
    state.lastExtractionTokens = messageCount * 50; // rough estimate
    state.toolCallCount = 0;
}
/**
 * Write a session memory summary to disk.
 */
export function writeSessionMemory(sessionId, projectRoot, summary) {
    const path = sessionMemoryPath(sessionId, projectRoot);
    writeFileSync(path, summary, 'utf-8');
}
/**
 * Read the current session memory summary.
 */
export function readSessionMemory(sessionId, projectRoot) {
    const path = sessionMemoryPath(sessionId, projectRoot);
    if (!existsSync(path))
        return null;
    try {
        return readFileSync(path, 'utf-8');
    }
    catch {
        return null;
    }
}
/** Reserved for future manual extraction trigger. */
export function manuallyExtractSessionMemory(_sessionId, _summary) {
    // Placeholder — will be expanded with LLM-based extraction
    return Promise.resolve({
        success: true,
        path: '',
        summary: '',
    });
}
/** Clean up state for a completed session. */
export function cleanupSessionMemory(sessionId) {
    _state.delete(sessionId);
}
/** Default sideQuery model (cheap, fast). */
export const SIDE_QUERY_MODEL = 'deepseek-v4-flash';
/**
 * Extract session memory via configured mode.
 * - 'regex' → template matching (Scheme B, always works)
 * - 'local-model' → local Qwen 2.5 via Ollama (falls back to regex)
 * - 'online-model' → remote Flash model sideQuery (falls back to regex)
 *
 * Fire-and-forget — runs asynchronously, does not block the main conversation.
 */
export async function extractSessionMemoryViaMode(messages, sessionId, projectRoot, config) {
    // Regex mode: use template extraction directly
    if (!config) {
        const summary = extractViaRegex(messages);
        writeSessionMemory(sessionId, projectRoot, summary);
        markExtractionCompleted(sessionId, messages.length);
        return;
    }
    // LLM mode
    try {
        const { callLLM } = await import('../llm/client.js');
        const transcript = messages.slice(-30).map((m) => {
            const role = m.role === 'assistant' ? 'Assistant' : 'User';
            return `[${role}]: ${(m.content ?? '').slice(0, 500)}`;
        }).join('\n\n');
        const prompt = [
            'Summarize the key decisions, facts, and context from this conversation.',
            'Focus on information useful for future sessions. Output concise bullet points.',
            '',
            '## Conversation',
            transcript,
            '',
            '## Summary',
        ].join('\n');
        const response = await callLLM(config.provider, {
            model: config.model,
            messages: [{ role: 'user', content: prompt, timestamp: new Date().toISOString() }],
            maxTokens: 1024,
            temperature: 0.1,
        });
        const summary = response.content?.trim();
        if (summary && summary.length > 20) {
            writeSessionMemory(sessionId, projectRoot, summary);
        }
        else {
            const fallback = extractViaRegex(messages);
            writeSessionMemory(sessionId, projectRoot, fallback);
        }
    }
    catch {
        // LLM failed → regex fallback
        const fallback = extractViaRegex(messages);
        writeSessionMemory(sessionId, projectRoot, fallback);
    }
    markExtractionCompleted(sessionId, messages.length);
}
//# sourceMappingURL=session-memory.js.map