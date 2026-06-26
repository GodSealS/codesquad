import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { fileURLToPath } from 'url';
import { resolveEnvValue } from '../../utils/env-resolver.js';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PKG_ROOT = join(__dirname, '..', '..', '..');
function loadApiSources() {
    const configPath = join(PKG_ROOT, 'models.config.yaml');
    try {
        if (!existsSync(configPath))
            return {};
        const raw = readFileSync(configPath, 'utf-8');
        const config = parseYaml(raw);
        const rawSources = config?.api?.sources ?? {};
        const result = {};
        for (const [name, src] of Object.entries(rawSources)) {
            result[name] = {
                baseUrl: src.baseUrl,
                apiKey: src.apiKey,
                provider: src.provider,
                supportsVision: src.supportsVision === true,
                isReasoning: src.isReasoning === true,
            };
        }
        return result;
    }
    catch {
        return {};
    }
}
export async function handleModels(_req, res) {
    try {
        const sources = loadApiSources();
        const models = Object.entries(sources).map(([name, info]) => ({
            name,
            supportsVision: info.supportsVision ?? false,
            isReasoning: info.isReasoning ?? false,
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ models }));
    }
    catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read model config' }));
    }
}
/**
 * POST /api/models/verify
 * Tests connectivity for each configured model by calling the API endpoint.
 * Returns { model → { ok, error? } }.
 */
export async function handleModelsVerify(_req, res) {
    const sources = loadApiSources();
    const results = {};
    // Group by baseUrl to avoid duplicate checks for same endpoint
    const testedEndpoints = new Map();
    for (const [model, src] of Object.entries(sources)) {
        const key = resolveEnvValue(src.apiKey);
        // If same baseUrl already tested successfully, reuse result
        if (testedEndpoints.has(src.baseUrl) && testedEndpoints.get(src.baseUrl) === true) {
            results[model] = { ok: true };
            continue;
        }
        if (!key || key.length < 10) {
            // Extract env var name from macro pattern for a helpful error
            const macroMatch = src.apiKey?.match?.(/\$\{(\w+)\}/);
            const envVarHint = macroMatch ? ` (environment variable ${macroMatch[1]} is not set)` : '';
            results[model] = { ok: false, error: `API key not set${envVarHint}` };
            continue;
        }
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const resp = await fetch(`${src.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${key}`,
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: 'hi' }],
                    max_tokens: 1,
                }),
                signal: controller.signal,
            });
            clearTimeout(timeout);
            // Read body text for detailed error info
            const bodyText = await resp.text().catch(() => '');
            if (resp.status === 200) {
                results[model] = { ok: true, status: 200 };
                testedEndpoints.set(src.baseUrl, true);
            }
            else if (resp.status === 401) {
                results[model] = { ok: false, error: 'Invalid API key (401)', status: 401 };
                testedEndpoints.set(src.baseUrl, false);
            }
            else if (resp.status === 402 || resp.status === 403) {
                // 402: payment/billing, 403: access denied / inactive
                const detail = bodyText.includes('BILLING') ? '账户欠费或已隔离' :
                    bodyText.includes('inactive') ? '端点未激活' :
                        `HTTP ${resp.status}: ${bodyText.slice(0, 80)}`;
                results[model] = { ok: false, error: detail, status: resp.status };
                testedEndpoints.set(src.baseUrl, false);
            }
            else if (resp.status === 404) {
                results[model] = { ok: false, error: `Model "${model}" not found (404)`, status: 404 };
                testedEndpoints.set(src.baseUrl, true); // endpoint is reachable
            }
            else {
                results[model] = { ok: false, error: `HTTP ${resp.status}: ${bodyText.slice(0, 100)}`, status: resp.status };
                testedEndpoints.set(src.baseUrl, false);
            }
        }
        catch (err) {
            results[model] = { ok: false, error: `Connection failed: ${err.message}` };
            testedEndpoints.set(src.baseUrl, false);
        }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ results }));
}
//# sourceMappingURL=models.js.map