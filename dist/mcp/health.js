/**
 * Health Check Endpoints
 *
 * Provides /healthz and /readyz endpoints for HTTP transport mode.
 *
 *   - /healthz: Simple alive check (always returns 200 if process is up)
 *   - /readyz:  Readiness check (stub-loader, .codesquad/, config valid)
 *
 * Used by load balancers, health probes, and CI monitors.
 */
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
/**
 * Simple liveness check: is the process running?
 * Always returns ok if the server can respond.
 */
export function healthCheck() {
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        checks: {
            process: { status: 'pass', detail: `PID ${process.pid}, uptime ${Math.floor(process.uptime())}s` },
            memory: { status: 'pass', detail: formatMemoryUsage() },
        },
    };
}
/**
 * Readiness check: is the server ready to accept requests?
 *
 * Checks:
 *   - .codesquad/ directory exists (prompt templates available)
 *   - At least one agent.md exists
 *   - MCP config is loadable
 */
export function readinessCheck(projectRoot, config) {
    const checks = {};
    let allPassed = true;
    // Check .codesquad/ exists
    const aiCoreDir = join(projectRoot, '.codesquad');
    if (existsSync(aiCoreDir)) {
        checks['aicore_dir'] = { status: 'pass', detail: aiCoreDir };
    }
    else {
        checks['aicore_dir'] = { status: 'fail', detail: '.codesquad/ not found — run codesquad init' };
        allPassed = false;
    }
    // Check agents directory
    const agentsDir = join(projectRoot, '.codesquad', 'agents');
    if (existsSync(agentsDir)) {
        try {
            const agentCount = readdirSync(agentsDir).filter(f => f.endsWith('.md')).length;
            const pass = agentCount > 0;
            checks['agents'] = {
                status: pass ? 'pass' : 'fail',
                detail: pass ? `${agentCount} agent(s) found` : 'No agents found',
            };
            if (!pass)
                allPassed = false;
        }
        catch {
            checks['agents'] = { status: 'fail', detail: 'Failed to read agents directory' };
            allPassed = false;
        }
    }
    else {
        checks['agents'] = { status: 'fail', detail: '.codesquad/agents/ not found' };
        allPassed = false;
    }
    // Check MCP config
    if (config) {
        checks['config'] = { status: 'pass', detail: 'mcp.config.yaml loaded' };
    }
    else {
        checks['config'] = { status: 'fail', detail: 'mcp.config.yaml not loaded' };
        allPassed = false;
    }
    return {
        ready: allPassed,
        timestamp: new Date().toISOString(),
        checks,
    };
}
/**
 * Format memory usage for health reporting.
 */
function formatMemoryUsage() {
    const usage = process.memoryUsage();
    const rssMB = Math.round(usage.rss / 1024 / 1024);
    const heapMB = Math.round(usage.heapUsed / 1024 / 1024);
    return `RSS ${rssMB}MB, Heap ${heapMB}MB`;
}
/**
 * Create an HTTP handler for health check endpoints.
 * Returns a function that handles GET /healthz and GET /readyz.
 */
export function createHealthHandler(projectRoot, getConfig) {
    return (req, res) => {
        if (req.method !== 'GET') {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }
        const jsonHeaders = { 'Content-Type': 'application/json' };
        if (req.url === '/healthz') {
            const status = healthCheck();
            res.writeHead(200, jsonHeaders);
            res.end(JSON.stringify(status));
        }
        else if (req.url === '/readyz') {
            const config = getConfig();
            const status = readinessCheck(projectRoot, config);
            res.writeHead(status.ready ? 200 : 503, jsonHeaders);
            res.end(JSON.stringify(status));
        }
        else {
            res.writeHead(404, jsonHeaders);
            res.end(JSON.stringify({ error: 'Health endpoint not found. Use /healthz or /readyz' }));
        }
    };
}
//# sourceMappingURL=health.js.map