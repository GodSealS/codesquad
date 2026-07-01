/**
 * TokenHub Gateway — per-apiKey send queue with cross-session throttling.
 *
 * Problem: multiple browser tabs = multiple sessions = concurrent LLM calls.
 * Each session independently sends requests to TokenHub, causing bursts that
 * trigger upstream 502 errors from DeepSeek backend.
 *
 * Solution: a shared gateway per unique apiKey. All sessions sharing the same
 * apiKey go through one serialized queue. The gateway enforces:
 *   1. One in-flight request at a time (serialized queue)
 *   2. Per-model SendCount (max RPM from models.config.yaml)
 *   3. 1s minimum cycle pacing: sleep(Max(0, cycleTime - elapsed))
 *
 * Architecture:
 *   models.config.yaml  →  loadGatewayConfigs()
 *     apiKey: ${TOKENHUB_API_KEY}, SendCount: 60
 *       ↓
 *   ApiKeyGateway("TOKENHUB_API_KEY")
 *     ├── send(model, fn) → queue → execute → pace → response
 *     └── shared by ALL sessions using this apiKey
 */
import { resolveEnvValue } from '../utils/env-resolver.js';
import { join } from 'path';
import { readYaml } from '../utils/yaml.js';
// ── Gateway Class ──
export class ApiKeyGateway {
    apiKey;
    baseUrl;
    models;
    queue = [];
    processing = false;
    lastSendEnd = 0;
    /** Per-model send timestamps (sliding 60s window). */
    modelSendHistory = new Map();
    constructor(apiKey, baseUrl, models) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.models = models;
    }
    /** Register/update a model's send config. */
    registerModel(name, config) {
        this.models.set(name, config);
    }
    /**
     * Enqueue a send request. Returns a Promise that resolves when the request
     * has been executed and the pacing delay has elapsed.
     */
    async send(model, execute) {
        return new Promise((resolve, reject) => {
            this.queue.push({ model, execute, resolve, reject });
            this.processQueue();
        });
    }
    /** Number of pending requests in the queue. */
    get pendingCount() {
        return this.queue.length;
    }
    /** Whether the gateway is currently processing. */
    get isBusy() {
        return this.processing || this.queue.length > 0;
    }
    // ── Internal ──
    async processQueue() {
        if (this.processing)
            return;
        this.processing = true;
        while (this.queue.length > 0) {
            const item = this.queue.shift();
            // ── Per-model rate limit check ──
            const modelCfg = this.models.get(item.model);
            const sendCount = modelCfg?.sendCount ?? 60; // default 60 RPM
            const cycleMs = Math.ceil(60_000 / sendCount); // min ms between sends for this model
            // Check per-model sliding window
            await this.waitForModelSlot(item.model, sendCount);
            // ── Global pacing: ensure ≥ cycleMs since last send ended ──
            const sinceLastEnd = Date.now() - this.lastSendEnd;
            if (sinceLastEnd < cycleMs && this.lastSendEnd > 0) {
                await new Promise(r => setTimeout(r, cycleMs - sinceLastEnd));
            }
            // ── Execute ──
            const t0 = Date.now();
            try {
                const response = await item.execute();
                // Record this send for model rate tracking
                this.recordModelSend(item.model);
                // ── Cycle pacing: ensure request→response ≥ cycleMs ──
                const elapsed = Date.now() - t0;
                if (elapsed < cycleMs) {
                    await new Promise(r => setTimeout(r, cycleMs - elapsed));
                }
                this.lastSendEnd = Date.now();
                item.resolve(response);
            }
            catch (err) {
                this.lastSendEnd = Date.now();
                item.reject(err);
            }
        }
        this.processing = false;
    }
    /** Wait until the model has an available send slot in its 60s window. */
    async waitForModelSlot(model, sendCount) {
        const now = Date.now();
        let history = this.modelSendHistory.get(model);
        if (!history) {
            this.modelSendHistory.set(model, []);
            return;
        }
        // Trim expired entries (>60s old)
        history = history.filter(ts => now - ts < 60_000);
        this.modelSendHistory.set(model, history);
        // If at capacity, wait until oldest entry expires
        if (history.length >= sendCount) {
            const oldest = history[0];
            const waitMs = 60_000 - (now - oldest) + 50; // +50ms safety margin
            if (waitMs > 0) {
                await new Promise(r => setTimeout(r, waitMs));
                // Re-check after waiting
                return this.waitForModelSlot(model, sendCount);
            }
        }
    }
    /** Record a completed send for per-model rate tracking. */
    recordModelSend(model) {
        let history = this.modelSendHistory.get(model);
        if (!history) {
            history = [];
            this.modelSendHistory.set(model, history);
        }
        history.push(Date.now());
        // Trim old entries
        const now = Date.now();
        this.modelSendHistory.set(model, history.filter(ts => now - ts < 60_000));
    }
}
// ── Singleton Registry ──
const gateways = new Map();
/**
 * Get or create the ApiKeyGateway for a given apiKey + baseUrl pair.
 * All sessions sharing the same apiKey@baseUrl get the SAME gateway instance,
 * ensuring cross-session throttling.
 */
export function getGateway(apiKey, baseUrl) {
    const id = `${apiKey}@${baseUrl}`;
    let gw = gateways.get(id);
    if (!gw) {
        gw = new ApiKeyGateway(apiKey, baseUrl, new Map());
        gateways.set(id, gw);
    }
    return gw;
}
// ── Config Loading ──
/**
 * Load SendCount configs from models.config.yaml and register them
 * with their respective gateways. Call once during server startup.
 */
export function loadGatewayConfigsFromYaml(projectRoot) {
    try {
        const configPath = join(projectRoot, 'models.config.yaml');
        const config = readYaml(configPath);
        const sources = config?.api?.sources;
        if (!sources)
            return;
        for (const [modelName, source] of Object.entries(sources)) {
            if (!source.baseUrl || !source.apiKey)
                continue;
            const apiKey = resolveEnvValue(source.apiKey);
            if (!apiKey)
                continue;
            const gw = getGateway(apiKey, source.baseUrl);
            gw.registerModel(modelName, {
                sendCount: source.SendCount ?? 60,
            });
        }
    }
    catch {
        // Config loading is best-effort — gateway works with defaults
    }
}
//# sourceMappingURL=tokenhub-gateway.js.map