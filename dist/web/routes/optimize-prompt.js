/**
 * Prompt optimization API — light-context pass-through to the same LLM endpoint.
 *
 * POST /api/optimize-prompt
 * Accepts: { prompt, agentName?, skillName?, modelName?, sessionId? }
 * Returns: { optimized }
 *
 * If sessionId is provided, injects last 3 conversation turns + agent/skill
 * definition summaries so the optimizer understands the conversation flow.
 */
import { join } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { resolveEnvValue } from '../../utils/env-resolver.js';
import { virtualExists, virtualReadFile } from '../../embedded/virtual-fs.js';
import { readEmbeddedFile } from '../../embedded/runtime.js';
import { load as loadSession } from '../../chat/session.js';
let PKG_ROOT;
let AICORE_DIR;
try {
    const __dirname = fileURLToPath(new URL('.', import.meta.url));
    PKG_ROOT = join(__dirname, '..', '..', '..');
    AICORE_DIR = join(PKG_ROOT, 'AICore');
}
catch {
    PKG_ROOT = process.cwd();
    AICORE_DIR = join(process.cwd(), 'AICore');
}
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString()));
            }
            catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}
function loadApiSources() {
    let raw = null;
    const configPath = join(PKG_ROOT, 'models.config.yaml');
    if (virtualExists(configPath)) {
        raw = virtualReadFile(configPath, 'utf-8');
    }
    if (raw === null) {
        const cwdPath = join(process.cwd(), 'models.config.yaml');
        if (virtualExists(cwdPath)) {
            raw = virtualReadFile(cwdPath, 'utf-8');
        }
    }
    if (raw === null) {
        try {
            raw = readEmbeddedFile('models.config.yaml');
        }
        catch { /* not embedded */ }
    }
    if (raw === null)
        return {};
    try {
        const config = parseYaml(raw);
        return config?.api?.sources ?? {};
    }
    catch {
        return {};
    }
}
export async function handleOptimizePrompt(req, res) {
    let body;
    try {
        body = (await readBody(req));
    }
    catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
    }
    if (!body.prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'prompt is required' }));
        return;
    }
    // ── Build light context from active session ──
    const contextParts = [];
    if (body.sessionId) {
        try {
            const session = await loadSession(body.sessionId);
            if (session) {
                // Resolve agent name (session.agent field may differ from agentName param)
                const effectiveAgent = body.agentName || session.agent;
                // 1) Last 3 conversation turns
                const chatMessages = (session.messages ?? [])
                    .filter((m) => m.role === 'user' || m.role === 'assistant')
                    .slice(-6); // 3 turns = 6 messages (user+assistant pairs)
                if (chatMessages.length > 0) {
                    contextParts.push('## Recent Conversation Context');
                    for (const m of chatMessages) {
                        const label = m.role === 'user' ? 'User' : 'Assistant';
                        const text = typeof m.content === 'string' ? m.content.slice(0, 500) : '';
                        contextParts.push(`[${label}] ${text}`);
                    }
                }
                // 2) Agent definition summary (first ~400 chars = description + whenToUse)
                if (effectiveAgent) {
                    const agentContent = tryReadAgentDef(effectiveAgent);
                    if (agentContent) {
                        contextParts.push(`\n## Agent Context: ${effectiveAgent}`);
                        contextParts.push(agentContent.slice(0, 400));
                    }
                }
                // 3) Skill definition summary (first ~400 chars)
                if (body.skillName) {
                    const skillContent = tryReadSkillDef(body.skillName);
                    if (skillContent) {
                        contextParts.push(`\n## Skill Context: ${body.skillName}`);
                        contextParts.push(skillContent.slice(0, 400));
                    }
                }
            }
        }
        catch {
            // Session not found or corrupted — proceed without context (non-blocking)
        }
    }
    const sources = loadApiSources();
    const sourceKey = body.modelName && sources[body.modelName] ? body.modelName : Object.keys(sources)[0];
    if (!sourceKey) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ optimized: body.prompt }));
        return;
    }
    const source = sources[sourceKey];
    // ── Build system prompt ──
    let systemMsg = `You are a prompt optimizer. Rewrite the following user prompt to be more precise, structured, and effective.

Rules:
- Return ONLY the optimized prompt text, no explanations or markdown wrappers.
- Preserve the user's intent, language, and tone. Do NOT add new requirements.
- If the conversation context is provided below, use it to avoid duplicating already-discussed topics and to make the prompt more specific to the ongoing conversation.`;
    if (contextParts.length > 0) {
        systemMsg += '\n\n' + contextParts.join('\n');
    }
    else {
        if (body.agentName)
            systemMsg += `\nThis prompt is for agent "${body.agentName}".`;
        if (body.skillName)
            systemMsg += `\nThe skill context is "${body.skillName}".`;
    }
    try {
        const response = await fetch(`${source.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${resolveEnvValue(source.apiKey) || ''}`,
            },
            body: JSON.stringify({
                model: sourceKey,
                messages: [
                    { role: 'system', content: systemMsg },
                    { role: 'user', content: body.prompt },
                ],
                max_tokens: 1024,
                temperature: 0.3,
            }),
        });
        if (!response.ok) {
            // Fallback: return original
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ optimized: body.prompt }));
            return;
        }
        const data = (await response.json());
        const optimized = data.choices?.[0]?.message?.content?.trim() || body.prompt;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ optimized }));
    }
    catch {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ optimized: body.prompt }));
    }
}
// ── Helpers ──
/** Read agent definition file, stripping frontmatter to get just the body. */
function tryReadAgentDef(name) {
    const p = join(AICORE_DIR, 'agents', `${name}.md`);
    if (!virtualExists(p))
        return null;
    try {
        const raw = virtualReadFile(p, 'utf-8');
        return stripFrontmatter(raw);
    }
    catch {
        return null;
    }
}
/** Read skill definition file, stripping frontmatter to get just the body. */
function tryReadSkillDef(name) {
    const p = join(AICORE_DIR, 'skills', name, 'SKILL.md');
    if (!virtualExists(p))
        return null;
    try {
        const raw = virtualReadFile(p, 'utf-8');
        return stripFrontmatter(raw);
    }
    catch {
        return null;
    }
}
/** Remove YAML frontmatter from markdown content. */
function stripFrontmatter(raw) {
    // Match opening ---, then everything until closing ---
    const match = raw.match(/^---\s*\n([\s\S]*?\n)---\s*\n/);
    if (match) {
        return raw.slice(match[0].length).trim();
    }
    return raw.trim();
}
//# sourceMappingURL=optimize-prompt.js.map