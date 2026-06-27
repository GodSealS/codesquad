/**
 * Providers API — list configured LLM providers with status.
 */
import { listProviders, resolveApiKey } from '../../llm/registry.js';
import { isKeyringAvailable } from '../../llm/keyring.js';
export async function handleProviders(req, res, _services) {
    const providers = listProviders();
    const result = [];
    for (const p of providers) {
        const hasKey = !!(await resolveApiKey(p.id));
        result.push({
            id: p.id,
            name: p.name,
            protocol: p.protocol,
            baseUrl: p.baseUrl,
            defaultModel: p.defaultModel,
            models: p.models,
            envVar: p.envVar,
            configured: hasKey,
        });
    }
    const keyringAvail = await isKeyringAvailable();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ providers: result, keyringAvailable: keyringAvail }));
}
//# sourceMappingURL=providers.js.map