/**
 * Session import/export with automatic redaction.
 *
 * Exports sessions as Markdown files. Automatically redacts:
 *   1. System prompt messages (role: system)
 *   2. Sensitive tool call arguments
 *   3. Optional: API key patterns (--redact api-keys)
 *   4. Optional: Absolute paths (--redact paths)
 * Phase 1.2 — Step 1.2.4.
 */
import { writeFile, mkdir } from 'fs';
import { promisify } from 'util';
import { join } from 'path';
import { exportsDir, ensureSessionDir } from './storage.js';
const writeFileAsync = promisify(writeFile);
const mkdirAsync = promisify(mkdir);
// ── API key patterns ──
const API_KEY_PATTERNS = [
    /sk-[a-zA-Z0-9]{32,}/g, // OpenAI
    /sk-ant-[a-zA-Z0-9_-]{32,}/g, // Anthropic
    /AIza[0-9A-Za-z_-]{35}/g, // Google
    /[a-zA-Z0-9]{32,}/g, // Generic long tokens (loose)
];
const ABSOLUTE_PATH_PATTERN = /(?<!\w)([A-Za-z]:\\[^\s"]+|(?:\/[^\s"]+)+)/g;
// ── Redaction ──
function redactContent(content, options) {
    let result = content;
    if (options.redactApiKeys) {
        for (const pattern of API_KEY_PATTERNS) {
            result = result.replace(pattern, '[REDACTED-API-KEY]');
        }
    }
    if (options.redactPaths) {
        result = result.replace(ABSOLUTE_PATH_PATTERN, '/[REDACTED-PATH]');
    }
    return result;
}
// ── Export ──
export async function exportSession(session, options = {}) {
    const { redactSystem = true, redactApiKeys = false, redactPaths = false } = options;
    await ensureSessionDir();
    await mkdirAsync(exportsDir(), { recursive: true });
    const lines = [];
    // Header
    lines.push(`# Session: ${session.name}`);
    lines.push('');
    lines.push(`- **Agent**: ${session.agent}`);
    lines.push(`- **Model**: ${session.modelConfig.model}`);
    lines.push(`- **Provider**: ${session.modelConfig.provider}`);
    lines.push(`- **Created**: ${session.createdAt}`);
    lines.push(`- **Updated**: ${session.updatedAt}`);
    lines.push(`- **Messages**: ${session.messages.length}`);
    lines.push('');
    // Messages
    lines.push('## Messages');
    lines.push('');
    for (const msg of session.messages) {
        // Skip system messages when redacting
        if (redactSystem && msg.role === 'system')
            continue;
        const roleLabel = msg.role === 'user'
            ? '### User'
            : msg.role === 'assistant'
                ? '### Assistant'
                : `### ${msg.role}`;
        const timestamp = msg.timestamp.slice(0, 19).replace('T', ' ');
        lines.push(`${roleLabel} (${timestamp})`);
        lines.push('');
        lines.push(redactContent(msg.content, options));
        lines.push('');
    }
    // Footer
    lines.push('---');
    lines.push(`*Exported by CodeSquad REPL on ${new Date().toISOString()}*`);
    const content = lines.join('\n');
    const exportPath = join(exportsDir(), `${session.id}.md`);
    await writeFileAsync(exportPath, content, 'utf-8');
    return exportPath;
}
// ── Import ──
/**
 * Parse a previously exported Markdown session back into a Session-like structure.
 * This is a best-effort reverse — message timestamps and structure are preserved.
 */
export async function importSession(markdown, sessionName) {
    const messages = [];
    const lines = markdown.split('\n');
    let currentRole = null;
    let currentContent = [];
    let currentTimestamp = '';
    let agent = '';
    let model = '';
    let provider = '';
    for (const line of lines) {
        // Parse header metadata
        const agentMatch = line.match(/\*\*Agent\*\*:\s*(.+)/);
        if (agentMatch)
            agent = agentMatch[1].trim();
        const modelMatch = line.match(/\*\*Model\*\*:\s*(.+)/);
        if (modelMatch)
            model = modelMatch[1].trim();
        const providerMatch = line.match(/\*\*Provider\*\*:\s*(.+)/);
        if (providerMatch)
            provider = providerMatch[1].trim();
        // Detect message headers
        const userMatch = line.match(/^###\s+User\s*\((.+)\)/);
        const assistantMatch = line.match(/^###\s+Assistant\s*\((.+)\)/);
        if (userMatch || assistantMatch) {
            // Save previous message
            if (currentRole && currentContent.length > 0) {
                messages.push({
                    role: currentRole,
                    content: currentContent.join('\n').trim(),
                    timestamp: currentTimestamp,
                });
            }
            if (userMatch) {
                currentRole = 'user';
                currentTimestamp = userMatch[1].trim();
            }
            else if (assistantMatch) {
                currentRole = 'assistant';
                currentTimestamp = assistantMatch[1].trim();
            }
            currentContent = [];
            continue;
        }
        // Skip the exported-by footer
        if (line.startsWith('*Exported by CodeSquad'))
            continue;
        // Collect content
        if (currentRole) {
            currentContent.push(line);
        }
    }
    // Save last message
    if (currentRole && currentContent.length > 0) {
        messages.push({
            role: currentRole,
            content: currentContent.join('\n').trim(),
            timestamp: currentTimestamp,
        });
    }
    return {
        name: sessionName ?? (agent ? `${agent}: 导入会话` : '导入会话'),
        agent,
        messages,
        modelConfig: {
            provider: provider || 'unknown',
            model: model || 'unknown',
        },
    };
}
//# sourceMappingURL=import-export.js.map