/**
 * MCP Command
 *
 * codesquad mcp [stdio|serve|status|convert-stubs|logs|metrics]
 *
 * Starts the CodeSquad MCP Server in various modes.
 */
import { resolve, join } from 'path';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { CodeSquadMCPServer, ALL_TOOLS } from '../mcp/server.js';
import { HttpTransport } from '../mcp/transport/http.js';
import { loadMcpConfig } from '../mcp/config.js';
import { resolveAuthToken, readSavedToken, generateToken, saveTokenFile } from '../mcp/auth.js';
import { handleDiscoveryTool } from '../mcp/tools/discovery-tools.js';
import { handleAgentTool } from '../mcp/tools/agent-tools.js';
import { handleSkillTool } from '../mcp/tools/skill-tools.js';
import { convertAllAgents, convertAllSkills } from '../core/stub-generator.js';
import { getCompletedSpans, exportTraceJSON, getActiveSpans } from '../mcp/observability/tracer.js';
/** Start MCP server in stdio mode (for IDE integration) */
export function handleMcpStdio(projectRoot) {
    const root = resolve(projectRoot ?? process.cwd());
    const server = new CodeSquadMCPServer(root);
    server.start();
    // Keep process alive; handle graceful shutdown
    const shutdown = () => { server.stop(); process.exit(0); };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
}
/** Start MCP server in HTTP mode */
export async function handleMcpServe(projectRoot, options) {
    const root = resolve(projectRoot ?? process.cwd());
    const config = loadMcpConfig(root);
    // Resolve auth token
    let authToken = options?.authToken
        ?? resolveAuthToken(config.server.auth_token)
        ?? readSavedToken(root);
    if (!authToken) {
        authToken = generateToken();
        saveTokenFile(root, authToken);
        console.log(`Generated MCP auth token: ${authToken}`);
        console.log(`Saved to Config/mcp-token.txt`);
    }
    const port = options?.port ?? config.server.http_port;
    const bind = options?.bind ?? config.server.bind ?? '127.0.0.1';
    // Build request router (shared with stdio)
    const requestHandler = async (request) => {
        // JSON-RPC 2.0: notifications (requests without id) MUST NOT receive a response.
        // Return a sentinel that the transport layer should ignore.
        const isNotification = request.id === undefined;
        const id = isNotification ? undefined : request.id;
        try {
            switch (request.method) {
                case 'initialize':
                    return {
                        jsonrpc: '2.0',
                        id,
                        result: {
                            protocolVersion: '2024-11-05',
                            capabilities: { tools: {} },
                            serverInfo: { name: 'codesquad-mcp', version: '0.1.0' },
                        },
                    };
                case 'tools/list':
                    return { jsonrpc: '2.0', id, result: { tools: ALL_TOOLS } };
                case 'tools/call': {
                    const params = request.params;
                    const toolName = (params?.name ?? '');
                    const args = (params?.arguments ?? {});
                    let result = handleDiscoveryTool(toolName, args);
                    if (!result)
                        result = await handleAgentTool(toolName, args);
                    if (!result)
                        result = await handleSkillTool(toolName, args);
                    if (result)
                        return { jsonrpc: '2.0', id, result };
                    return { jsonrpc: '2.0', id, error: { code: -32601, message: `Tool not found: ${toolName}` } };
                }
                case 'ping':
                    return { jsonrpc: '2.0', id, result: {} };
                default:
                    return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method: ${request.method}` } };
            }
        }
        catch (err) {
            return { jsonrpc: '2.0', id, error: { code: -32603, message: String(err) } };
        }
    };
    const transport = new HttpTransport(requestHandler, {
        port,
        bind,
        authToken,
        corsOrigins: config.server.cors_origins,
        healthGetter: () => ({ projectRoot: root, config }),
    });
    const { port: actualPort, portFallback } = await transport.start();
    // If the requested port was busy and we fell back, persist the new port
    // to mcp.config.yaml so future starts pick up the correct port.
    if (portFallback) {
        console.log(`\n⚠ Port ${port} is busy — using port ${actualPort} instead.`);
        console.log(`  Updated Config/mcp.config.yaml → http_port: ${actualPort}`);
        config.server.http_port = actualPort;
        const { saveMcpConfig } = await import('../mcp/config.js');
        await saveMcpConfig(root, config);
    }
    console.log(`\nMCP Server running on http://${bind}:${actualPort}/mcp`);
    console.log(`Health: http://${bind}:${actualPort}/healthz | http://${bind}:${actualPort}/readyz`);
    const shutdown = () => { transport.stop(); process.exit(0); };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
}
/** Convert AICore files to MCP stubs */
export function handleConvertStubs(outputDir) {
    const outDir = resolve(outputDir ?? join(process.cwd(), '.aicore-mcp-stubs'));
    try {
        mkdirSync(outDir, { recursive: true });
    }
    catch (err) {
        console.error(`Failed to create output directory: ${outDir}`);
        console.error(err.message);
        process.exit(1);
    }
    console.log(`Converting AICore agents/skills to MCP stubs in: ${outDir}\n`);
    const agentResult = convertAllAgents(outDir);
    console.log(`Agents: ${agentResult.converted}/${agentResult.total} converted`);
    if (agentResult.errors.length > 0)
        console.log('  Errors:', agentResult.errors);
    const skillResult = convertAllSkills(outDir);
    console.log(`Skills: ${skillResult.converted}/${skillResult.total} converted`);
    if (skillResult.errors.length > 0)
        console.log('  Errors:', skillResult.errors);
    const total = agentResult.converted + skillResult.converted;
    console.log(`\nDone! ${total}/${agentResult.total + skillResult.total} stubs generated.`);
}
/** Show MCP server status with trace/log info */
export function handleMcpStatus(projectRoot) {
    const root = resolve(projectRoot ?? process.cwd());
    const config = loadMcpConfig(root);
    console.log('CodeSquad MCP Server Status');
    console.log('===========================');
    console.log(`  Transport:   ${config.server.transport}`);
    if (config.server.transport === 'http') {
        console.log(`  HTTP Port:   ${config.server.http_port}`);
        console.log(`  Bind:        ${config.server.bind ?? '127.0.0.1'}`);
    }
    console.log(`  Log Level:   ${config.observability.log_level}`);
    console.log(`  Metrics:     ${config.observability.metrics_enabled ? 'enabled' : 'disabled'}`);
    console.log(`  Tracing:     ${config.observability.trace_enabled ? 'enabled' : 'disabled'}`);
    console.log(`  Provider:    ${config.provider.default}`);
    const activeSpans = getActiveSpans();
    const completedSpans = getCompletedSpans();
    console.log(`  Active spans: ${activeSpans.length}`);
    console.log(`  Completed spans: ${completedSpans.length}`);
    // Check if server PID file exists
    const pidPath = join(root, 'Config', 'codesquad-mcp.pid');
    if (existsSync(pidPath)) {
        console.log(`  PID file:    ${pidPath}`);
        console.log(`  PID info:    ${readFileSync(pidPath, 'utf-8').replace(/\n/g, ', ')}`);
    }
    else {
        console.log('  PID file:    Not running');
    }
}
/** Export trace data as JSON */
export function handleMcpLogs() {
    const traceJSON = exportTraceJSON();
    console.log(traceJSON);
}
/** Export metrics (simple summary from in-process counters) */
export function handleMcpMetrics() {
    const spans = getCompletedSpans();
    const totalSpans = spans.length;
    const errSpans = spans.filter(s => s.status === 'error').length;
    const avgDuration = spans.length > 0
        ? spans.reduce((sum, s) => sum + (s.durationMs ?? 0), 0) / spans.length
        : 0;
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        metrics: {
            total_spans: totalSpans,
            error_spans: errSpans,
            success_rate: totalSpans > 0 ? ((totalSpans - errSpans) / totalSpans * 100).toFixed(1) + '%' : 'N/A',
            avg_span_duration_ms: Math.round(avgDuration),
            active_spans: getActiveSpans().length,
        },
    }, null, 2));
}
/** Bridge subcommand has been removed — REPL and Web Console are the primary interfaces. */
/** Inject MCP server configuration into AICore/settings.json */
export function injectMcpServerConfig(root) {
    const aicoreDir = join(root, 'AICore');
    const settingsPath = join(aicoreDir, 'settings.json');
    // Fallback: create a minimal settings.json if it doesn't exist.
    // Inject codesquad MCP server config into settings.json
    if (!existsSync(settingsPath)) {
        mkdirSync(aicoreDir, { recursive: true });
        const minimal = {
            $schema: 'https://www.codebuddy.cn/docs/cli/settings',
            mcpServers: {
                codesquad: {
                    command: 'npx',
                    args: ['codesquad', 'mcp', 'stdio'],
                    description: 'CodeSquad MCP Server — AI-native game development toolchain',
                },
            },
            permissions: {
                allow: ['Bash(git *)', 'Bash(ls *)', 'Bash(dir *)', 'Read(*)', 'Write(*)', 'Edit(*)'],
                deny: ['Bash(rm -rf *)', 'Bash(sudo *)'],
            },
            sandbox: {
                enabled: true,
                autoAllowBashIfSandboxed: true,
            },
        };
        writeFileSync(settingsPath, JSON.stringify(minimal, null, 2) + '\n', 'utf-8');
        console.log('  Created AICore/settings.json with MCP server config');
        return;
    }
    try {
        const raw = readFileSync(settingsPath, 'utf-8');
        const settings = JSON.parse(raw);
        // Skip if a codesquad entry is already present (idempotent re-run).
        if (settings?.mcpServers?.codesquad)
            return;
        if (!settings.mcpServers)
            settings.mcpServers = {};
        settings.mcpServers.codesquad = {
            command: 'npx',
            args: ['codesquad', 'mcp', 'stdio'],
            description: 'CodeSquad MCP Server — AI-native game development toolchain',
        };
        // Preserve the trailing newline (if any) of the original file so a
        // hand-maintained settings.json does not see a noisy full-rewrite diff.
        const trailingNewline = raw.endsWith('\n') ? '\n' : '';
        writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + trailingNewline, 'utf-8');
        console.log('  Injected MCP server config into AICore/settings.json');
    }
    catch {
        // Non-fatal — settings.json might be in a different format
        console.log('  Note: Could not inject MCP config into settings.json (non-fatal)');
    }
}
/**
 * Inverse of injectMcpServerConfig: remove the codesquad entry from
 * AICore/settings.json. Used by `--restore` to leave settings.json in the
 * same shape as a fresh `init` (no stale MCP routing entries).
 */
function stripMcpServerConfig(root) {
    const settingsPath = join(root, 'AICore', 'settings.json');
    if (!existsSync(settingsPath))
        return;
    try {
        const raw = readFileSync(settingsPath, 'utf-8');
        const settings = JSON.parse(raw);
        if (!settings?.mcpServers?.codesquad)
            return; // nothing to do
        delete settings.mcpServers.codesquad;
        if (Object.keys(settings.mcpServers).length === 0) {
            delete settings.mcpServers;
        }
        const trailingNewline = raw.endsWith('\n') ? '\n' : '';
        writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + trailingNewline, 'utf-8');
        console.log('  Removed MCP server config from AICore/settings.json');
    }
    catch (err) {
        console.log('  Note: Could not strip MCP config from settings.json (non-fatal):', err.message);
    }
}
//# sourceMappingURL=mcp.js.map