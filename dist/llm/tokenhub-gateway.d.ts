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
export interface ModelSendConfig {
    /** Max requests per minute (default 60). */
    sendCount: number;
}
export interface GatewayConfig {
    apiKey: string;
    baseUrl: string;
    models: Map<string, ModelSendConfig>;
}
export declare class ApiKeyGateway {
    readonly apiKey: string;
    readonly baseUrl: string;
    private models;
    private queue;
    private processing;
    private lastSendEnd;
    /** Per-model send timestamps (sliding 60s window). */
    private modelSendHistory;
    constructor(apiKey: string, baseUrl: string, models: Map<string, ModelSendConfig>);
    /** Register/update a model's send config. */
    registerModel(name: string, config: ModelSendConfig): void;
    /**
     * Enqueue a send request. Returns a Promise that resolves when the request
     * has been executed and the pacing delay has elapsed.
     */
    send(model: string, execute: () => Promise<Response>): Promise<Response>;
    /** Number of pending requests in the queue. */
    get pendingCount(): number;
    /** Whether the gateway is currently processing. */
    get isBusy(): boolean;
    private processQueue;
    /** Wait until the model has an available send slot in its 60s window. */
    private waitForModelSlot;
    /** Record a completed send for per-model rate tracking. */
    private recordModelSend;
}
/**
 * Get or create the ApiKeyGateway for a given apiKey + baseUrl pair.
 * All sessions sharing the same apiKey@baseUrl get the SAME gateway instance,
 * ensuring cross-session throttling.
 */
export declare function getGateway(apiKey: string, baseUrl: string): ApiKeyGateway;
/**
 * Load SendCount configs from models.config.yaml and register them
 * with their respective gateways. Call once during server startup.
 */
export declare function loadGatewayConfigsFromYaml(projectRoot: string): void;
//# sourceMappingURL=tokenhub-gateway.d.ts.map