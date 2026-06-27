/**
 * MCP Server Configuration
 *
 * Loads and validates mcp.config.yaml from the project's AICore/ directory.
 * Provides sensible defaults for all fields.
 */
/** Shape of mcp.config.yaml */
export interface McpConfig {
    version: number;
    /** P0 fix: global enable/disable flag — when disabled, server.start() is a no-op */
    disabled?: boolean;
    server: {
        transport: 'stdio' | 'http';
        http_port: number;
        auth_token: string;
        bind?: string;
        cors_origins?: string[];
    };
    provider: {
        default: string;
        routing: Record<string, string>;
        fallback_chain: string[];
        call_timeout_ms: number;
        circuit_breaker: {
            failure_threshold: number;
            window_seconds: number;
        };
    };
    workspace: {
        default_root: string;
        enforce_boundary: boolean;
        read_only_extras: string[];
        auto_init: boolean;
    };
    budget: {
        per_call_max_tokens: number;
        per_call_cost_usd: number;
        per_session_cost_usd: number;
    };
    tools: {
        enabled: string[];
        bash: {
            enabled: boolean;
            whitelist: string[];
        };
    };
    observability: {
        log_level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
        log_format: 'json' | 'text';
        metrics_enabled: boolean;
        trace_enabled: boolean;
        otel_endpoint: string;
        audit_log_path: string;
    };
    /** Optional: context soft-truncation settings */
    context: {
        soft_limit_tokens: number;
    };
}
/** Sensible defaults for all fields */
export declare const DEFAULT_MCP_CONFIG: McpConfig;
/**
 * Load mcp.config.yaml from a project directory, merging with defaults.
 * Returns defaults if the file doesn't exist.
 */
export declare function loadMcpConfig(projectRoot: string): McpConfig;
/** Save mcp.config.yaml to a project (uses dynamic import for ESM compat) */
export declare function saveMcpConfig(projectRoot: string, config: McpConfig): Promise<void>;
//# sourceMappingURL=config.d.ts.map