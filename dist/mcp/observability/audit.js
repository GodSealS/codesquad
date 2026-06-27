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
import { appendFileSync, existsSync, renameSync, statSync, readdirSync, unlinkSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
// ── Configuration ──
const DEFAULT_RETENTION_DAYS = 30;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_ROTATION_FILES = 10;
let _config = null;
let _auditPath = null;
/** Initialize audit logger (call once at server start) */
export function initAudit(config, projectRoot) {
    _config = config;
    _auditPath = join(projectRoot, config.observability.audit_log_path);
    // Ensure parent directory exists
    const dir = dirname(_auditPath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    // Cleanup old logs on startup
    cleanupOldLogs(dir);
}
// ── API Key Masking ──
/** Mask an API key: "sk-abc123xyz" → "sk-***-***-xyz" */
export function maskApiKey(key) {
    if (!key || key.length < 8)
        return '***';
    const prefix = key.slice(0, 3);
    const suffix = key.slice(-3);
    return `${prefix}-***-***-${suffix}`;
}
// ── File Rotation ──
/** Rotate audit log if it exceeds MAX_FILE_SIZE_BYTES */
function rotateIfNeeded() {
    if (!_auditPath || !existsSync(_auditPath))
        return;
    try {
        const stat = statSync(_auditPath);
        if (stat.size < MAX_FILE_SIZE_BYTES)
            return;
        // Shift existing rotation files
        for (let i = MAX_ROTATION_FILES - 1; i >= 0; i--) {
            const oldPath = i === 0 ? _auditPath : `${_auditPath}.${i}`;
            const newPath = `${_auditPath}.${i + 1}`;
            if (existsSync(oldPath)) {
                if (i >= MAX_ROTATION_FILES - 1) {
                    unlinkSync(oldPath); // Delete oldest
                }
                else {
                    renameSync(oldPath, newPath);
                }
            }
        }
    }
    catch {
        // Rotation failure is non-fatal
    }
}
/** Delete audit logs older than retention_days */
function cleanupOldLogs(dir) {
    const retentionDays = DEFAULT_RETENTION_DAYS;
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    try {
        const files = readdirSync(dir).filter(f => f.startsWith('audit'));
        for (const file of files) {
            const filePath = join(dir, file);
            try {
                const stat = statSync(filePath);
                if (stat.mtimeMs < cutoff) {
                    unlinkSync(filePath);
                }
            }
            catch {
                // Skip unreadable files
            }
        }
    }
    catch {
        // Directory may not exist yet
    }
}
// ── Writing ──
/** Write a single audit entry */
function writeEntry(entry) {
    if (!_auditPath)
        return;
    try {
        rotateIfNeeded();
        appendFileSync(_auditPath, JSON.stringify(entry) + '\n', 'utf-8');
    }
    catch {
        // Audit write failure is non-fatal — log to stderr
        process.stderr.write(`[audit] Failed to write audit entry: ${entry.event}\n`);
    }
}
// ── Public API ──
export const audit = {
    /** Log an agent.invoke event */
    agentInvoke(agentName, success, modelConfig, usage, durationMs, error) {
        writeEntry({
            timestamp: new Date().toISOString(),
            event: 'agent.invoke',
            agent: agentName,
            provider: modelConfig?.provider,
            model: modelConfig?.model,
            masked_api_key: modelConfig?.api_key ? maskApiKey(modelConfig.api_key) : undefined,
            usage,
            success,
            error,
            duration_ms: durationMs,
        });
    },
    /** Log a skill.invoke event */
    skillInvoke(skillName, success, modelConfig, usage, durationMs, error) {
        writeEntry({
            timestamp: new Date().toISOString(),
            event: 'skill.invoke',
            skill: skillName,
            provider: modelConfig?.provider,
            model: modelConfig?.model,
            masked_api_key: modelConfig?.api_key ? maskApiKey(modelConfig.api_key) : undefined,
            usage,
            success,
            error,
            duration_ms: durationMs,
        });
    },
    /** Log an LLM API call */
    llmCall(provider, model, apiKey, success, usage, durationMs, error) {
        writeEntry({
            timestamp: new Date().toISOString(),
            event: 'llm.call',
            provider,
            model,
            masked_api_key: maskApiKey(apiKey),
            usage,
            success,
            error,
            duration_ms: durationMs,
        });
    },
    /** Log a tool call */
    toolCall(toolName, agentName, success, durationMs, error) {
        writeEntry({
            timestamp: new Date().toISOString(),
            event: 'tool.call',
            tool: toolName,
            agent: agentName,
            success,
            error,
            duration_ms: durationMs,
        });
    },
    /** Log server start */
    serverStart(transport, port) {
        writeEntry({
            timestamp: new Date().toISOString(),
            event: 'mcp.server.start',
            success: true,
            tool: transport,
            error: port ? `port=${port}` : undefined,
        });
    },
    /** Log server stop */
    serverStop() {
        writeEntry({
            timestamp: new Date().toISOString(),
            event: 'mcp.server.stop',
            success: true,
        });
    },
};
//# sourceMappingURL=audit.js.map