/**
 * MCP Server Configuration
 *
 * Loads and validates mcp.config.yaml from the project's .codesquad/ directory.
 * Provides sensible defaults for all fields.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
/** Sensible defaults for all fields */
export const DEFAULT_MCP_CONFIG = {
    version: 1,
    server: {
        transport: 'stdio',
        http_port: 9090,
        auth_token: '${MCP_AUTH_TOKEN}',
        bind: '127.0.0.1',
    },
    provider: {
        default: 'anthropic',
        routing: {
            anthropic: 'claude-sonnet-4-20250514',
            'openai-compatible': 'gpt-4o',
            openai: 'gpt-4o',
            deepseek: 'deepseek-chat',
            kimi: 'kimi-k2.6',
        },
        fallback_chain: ['anthropic', 'openai-compatible'],
        call_timeout_ms: 60000,
        circuit_breaker: {
            failure_threshold: 5,
            window_seconds: 60,
        },
    },
    workspace: {
        default_root: '${cwd}',
        enforce_boundary: true,
        read_only_extras: [],
        auto_init: false, // Per D-01: caller responsible for `codesquad init` before MCP server start
    },
    budget: {
        per_call_max_tokens: 8192,
        per_call_cost_usd: 0.5,
        per_session_cost_usd: 5.0,
    },
    tools: {
        enabled: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
        bash: {
            enabled: false,
            whitelist: ['git status', 'git diff', 'git log', 'npm test'],
        },
    },
    observability: {
        log_level: 'info',
        log_format: 'json',
        metrics_enabled: true,
        trace_enabled: true,
        otel_endpoint: '',
        audit_log_path: 'Config/audit.log',
    },
    context: {
        soft_limit_tokens: 100000,
    },
};
/** Default config path relative to project root */
const MCP_CONFIG_FILENAME = 'Config/mcp.config.yaml';
/** Deep clone a config object (prevents shared reference pollution) */
function deepCloneConfig(cfg) {
    return JSON.parse(JSON.stringify(cfg));
}
/**
 * Load mcp.config.yaml from a project directory, merging with defaults.
 * Returns defaults if the file doesn't exist.
 */
export function loadMcpConfig(projectRoot) {
    const configPath = join(projectRoot, MCP_CONFIG_FILENAME);
    if (!existsSync(configPath)) {
        return deepCloneConfig(DEFAULT_MCP_CONFIG);
    }
    try {
        const raw = readFileSync(configPath, 'utf-8');
        const parsed = parseYaml(raw);
        // Deep merge: top-level keys only (simpler than full deep merge)
        return {
            version: parsed.version ?? DEFAULT_MCP_CONFIG.version,
            disabled: parsed.disabled, // P0 fix: propagate disabled flag from config file
            server: { ...DEFAULT_MCP_CONFIG.server, ...parsed.server },
            provider: {
                ...DEFAULT_MCP_CONFIG.provider,
                ...parsed.provider,
                routing: { ...DEFAULT_MCP_CONFIG.provider.routing, ...(parsed.provider?.routing ?? {}) },
                fallback_chain: parsed.provider?.fallback_chain ?? DEFAULT_MCP_CONFIG.provider.fallback_chain,
                circuit_breaker: {
                    failure_threshold: parsed.provider?.circuit_breaker?.failure_threshold
                        ?? DEFAULT_MCP_CONFIG.provider.circuit_breaker.failure_threshold,
                    window_seconds: parsed.provider?.circuit_breaker?.window_seconds
                        ?? DEFAULT_MCP_CONFIG.provider.circuit_breaker.window_seconds,
                },
            },
            workspace: { ...DEFAULT_MCP_CONFIG.workspace, ...parsed.workspace },
            budget: { ...DEFAULT_MCP_CONFIG.budget, ...parsed.budget },
            tools: {
                ...DEFAULT_MCP_CONFIG.tools,
                ...parsed.tools,
                bash: { ...DEFAULT_MCP_CONFIG.tools.bash, ...parsed.tools?.bash },
            },
            observability: {
                ...DEFAULT_MCP_CONFIG.observability,
                ...parsed.observability,
            },
            context: {
                soft_limit_tokens: parsed.context?.soft_limit_tokens ?? DEFAULT_MCP_CONFIG.context.soft_limit_tokens,
            },
        };
    }
    catch {
        return deepCloneConfig(DEFAULT_MCP_CONFIG);
    }
}
/** Save mcp.config.yaml to a project (uses dynamic import for ESM compat) */
export async function saveMcpConfig(projectRoot, config) {
    const configPath = join(projectRoot, MCP_CONFIG_FILENAME);
    const { writeYaml } = await import('../utils/yaml.js');
    writeYaml(configPath, config);
}
//# sourceMappingURL=config.js.map