/**
 * Audit Logger — JSONL Audit Trail
 *
 * Records agent.invoke, skill.invoke, and LLM API calls for compliance.
 * Implements D-08 decisions:
 *   - JSONL format
 *   - API key masking (last 3 chars preserved)
 *   - 100MB rotation (max 10 files)
 *   - 30-day retention (cleanup old logs)
 *
 * All writes are synchronous (fs.appendFileSync) for audit reliability.
 * Performance cost is negligible for typical workloads (~1ms per write).
 */
import { type McpConfig } from '../config.js';
type AuditEventType = 'agent.invoke' | 'skill.invoke' | 'llm.call' | 'mcp.server.start' | 'mcp.server.stop' | 'tool.call';
interface AuditEntry {
    timestamp: string;
    event: AuditEventType;
    agent?: string;
    skill?: string;
    tool?: string;
    provider?: string;
    model?: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    success: boolean;
    error?: string;
    duration_ms?: number;
    masked_api_key?: string;
}
/** Initialize audit logger (call once at server start) */
export declare function initAudit(config: McpConfig, projectRoot: string): void;
/** Mask an API key: "sk-abc123xyz" → "sk-***-***-xyz" */
export declare function maskApiKey(key: string): string;
export declare const audit: {
    /** Log an agent.invoke event */
    agentInvoke(agentName: string, success: boolean, modelConfig?: {
        provider: string;
        model: string;
        api_key?: string;
    }, usage?: AuditEntry["usage"], durationMs?: number, error?: string): void;
    /** Log a skill.invoke event */
    skillInvoke(skillName: string, success: boolean, modelConfig?: {
        provider: string;
        model: string;
        api_key?: string;
    }, usage?: AuditEntry["usage"], durationMs?: number, error?: string): void;
    /** Log an LLM API call */
    llmCall(provider: string, model: string, apiKey: string, success: boolean, usage?: AuditEntry["usage"], durationMs?: number, error?: string): void;
    /** Log a tool call */
    toolCall(toolName: string, agentName: string | undefined, success: boolean, durationMs?: number, error?: string): void;
    /** Log server start */
    serverStart(transport: string, port?: number): void;
    /** Log server stop */
    serverStop(): void;
};
export {};
//# sourceMappingURL=audit.d.ts.map