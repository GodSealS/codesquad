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
import type http from 'http';
/**
 * P1 fix: now delegates to runAgent() (shared execution engine) instead of
 * manually building a system prompt and calling the LLM directly. This ensures:
 *   - Full tool execution loop (Bash, Read, Write, Edit, Grep, Glob, etc.)
 *   - Prompt caching + system prompt from agent-runner (builtin-sections, rules, hooks)
 *   - Fallback provider chain
 *   - Token budget + auto-compact
 *   - Consistent behavior with the streaming endpoint
 */
export declare function handleChatV2(req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
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
export declare function handleChatStream(req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
/**
 * POST /api/chat/respond-permission
 *
 * Accepts user's response to a tool permission request.
 * Body: { sessionId, toolCallId, approved: boolean }
 */
export declare function handlePermissionResponse(req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
//# sourceMappingURL=chat-v2.d.ts.map