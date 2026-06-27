/**
 * Health Check Endpoints
 *
 * Provides /healthz and /readyz endpoints for HTTP transport mode.
 *
 *   - /healthz: Simple alive check (always returns 200 if process is up)
 *   - /readyz:  Readiness check (stub-loader, AICore/, config valid)
 *
 * Used by load balancers, health probes, and CI monitors.
 */
import type { McpConfig } from './config.js';
interface HealthStatus {
    status: 'ok' | 'degraded' | 'down';
    timestamp: string;
    uptime: number;
    checks: Record<string, {
        status: 'pass' | 'fail';
        detail?: string;
    }>;
}
interface ReadinessStatus {
    ready: boolean;
    timestamp: string;
    checks: Record<string, {
        status: 'pass' | 'fail';
        detail?: string;
    }>;
}
/**
 * Simple liveness check: is the process running?
 * Always returns ok if the server can respond.
 */
export declare function healthCheck(): HealthStatus;
/**
 * Readiness check: is the server ready to accept requests?
 *
 * Checks:
 *   - AICore/ directory exists (prompt templates available)
 *   - At least one agent.md exists
 *   - MCP config is loadable
 */
export declare function readinessCheck(projectRoot: string, config: McpConfig): ReadinessStatus;
/**
 * Create an HTTP handler for health check endpoints.
 * Returns a function that handles GET /healthz and GET /readyz.
 */
export declare function createHealthHandler(projectRoot: string, getConfig: () => McpConfig): (req: {
    method?: string;
    url?: string;
}, res: {
    writeHead: (status: number, headers?: Record<string, string>) => void;
    end: (body: string) => void;
}) => void;
export {};
//# sourceMappingURL=health.d.ts.map