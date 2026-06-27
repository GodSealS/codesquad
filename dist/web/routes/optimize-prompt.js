/**
 * Prompt optimization API — simple pass-through to the same LLM endpoint.
 *
 * POST /api/optimize-prompt
 * Accepts: { prompt, agentName?, skillName? }
 * Returns: { optimized }
 */
import { join } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { resolveEnvValue } from '../../utils/env-resolver.js';
import { virtualExists, virtualReadFile } from '../../embedded/virtual-fs.js';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PKG_ROOT = join(__dirname, '..', '..', '..');
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
    const configPath = join(PKG_ROOT, 'models.config.yaml');
    try {
        if (!virtualExists(configPath))
            return {};
        const raw = virtualReadFile(configPath, 'utf-8');
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
    const sources = loadApiSources();
    const sourceKey = body.modelName && sources[body.modelName] ? body.modelName : Object.keys(sources)[0];
    if (!sourceKey) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ optimized: body.prompt }));
        return;
    }
    const source = sources[sourceKey];
    const systemMsg = `You are a prompt optimizer. Rewrite the following prompt to be more precise, structured, and effective. ${body.agentName ? `The prompt is for agent "${body.agentName}".` : ''} ${body.skillName ? `The skill context is "${body.skillName}".` : ''} Return ONLY the optimized prompt text, no explanations.`;
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
//# sourceMappingURL=optimize-prompt.js.map