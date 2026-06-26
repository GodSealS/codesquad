/**
 * MCP Configuration API — GET/POST endpoints for Web UI ↔ AICore/settings.json sync.
 *
 * GET  /api/mcp/servers   → Return current mcpServers block from AICore/settings.json
 * POST /api/mcp/servers   → Write mcpServers config from UI to AICore/settings.json
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
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
/**
 * GET /api/mcp/servers
 * Returns the current mcpServers configuration from AICore/settings.json.
 */
export async function handleMcpGet(_req, res, aicoreDir) {
    const settingsPath = join(aicoreDir, 'settings.json');
    try {
        if (!existsSync(settingsPath)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ mcpServers: {} }));
            return;
        }
        const raw = readFileSync(settingsPath, 'utf-8');
        const settings = JSON.parse(raw);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ mcpServers: settings.mcpServers ?? {} }));
    }
    catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read MCP config' }));
    }
}
/**
 * POST /api/mcp/servers
 * Body: { mcpServers: Record<string, McpServerEntry> }
 * Writes the MCP servers configuration into AICore/settings.json.
 */
export async function handleMcpPost(req, res, aicoreDir) {
    let body;
    try {
        body = (await readBody(req));
    }
    catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
    }
    if (!body.mcpServers) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'mcpServers field is required' }));
        return;
    }
    const settingsPath = join(aicoreDir, 'settings.json');
    try {
        let settings = {};
        if (existsSync(settingsPath)) {
            const raw = readFileSync(settingsPath, 'utf-8');
            settings = JSON.parse(raw);
        }
        settings.mcpServers = body.mcpServers;
        writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
    }
    catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Failed to write MCP config: ${err.message}` }));
    }
}
/**
 * POST /api/mcp/reload
 * Hot-reload MCP tools from AICore/settings.json without server restart.
 */
export async function handleMcpReload(_req, res, aicoreDir) {
    try {
        const { unregisterToolsByPrefix } = await import('../../tools/registry.js');
        const removed = unregisterToolsByPrefix('mcp__');
        const { loadAndRegisterMCPTools } = await import('../../repl/index.js');
        await loadAndRegisterMCPTools(aicoreDir);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, message: `MCP tools reloaded (${removed} removed, new loaded)` }));
    }
    catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `MCP reload failed: ${err.message}` }));
    }
}
/**
 * POST /api/mcp/verify
 * Body: { url, type }
 * Tests connectivity to an MCP server endpoint.
 * Returns { ok: true } on success or { ok: false, error } on failure.
 */
export async function handleMcpVerify(req, res) {
    let body;
    try {
        body = (await readBody(req));
    }
    catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }));
        return;
    }
    const { url, type } = body;
    if (!url) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'url is required' }));
        return;
    }
    // SSE/HTTP MCP: send initialization request and check for 200 + SSE headers
    if (type === 'sse' || type === 'http') {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {} }, id: 1 }),
                signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!resp.ok) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: `HTTP ${resp.status}: ${resp.statusText}` }));
                return;
            }
            const text = await resp.text();
            // SSE response starts with "data:" or is valid SSE
            const isSse = text.includes('data:') || resp.headers.get('content-type')?.includes('text/event-stream');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: isSse, status: resp.status, contentType: resp.headers.get('content-type') }));
        }
        catch (err) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: `Connection failed: ${err.message}` }));
        }
        return;
    }
    // stdio: check if the command exists (basic validation only)
    if (type === 'stdio') {
        const cmd = url.split(' ')[0];
        try {
            const { execSync } = await import('child_process');
            execSync(`where ${cmd} 2>nul || which ${cmd} 2>/dev/null || echo ""`, { timeout: 3000, stdio: 'pipe' });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, message: `Command "${cmd}" found` }));
        }
        catch {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: `Command "${cmd}" not found` }));
        }
        return;
    }
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: `Unknown MCP type: ${type || 'unspecified'}` }));
}
/**
 * GET /api/mcp/status
 * Returns connection status for all configured MCP servers.
 * Called by the Web UI on page load and every 60s for heartbeat.
 */
export async function handleMcpStatus(_req, res, aicoreDir) {
    const settingsPath = join(aicoreDir, 'settings.json');
    const servers = [];
    const now = new Date().toISOString();
    try {
        if (!existsSync(settingsPath)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ servers: [], timestamp: now }));
            return;
        }
        const raw = readFileSync(settingsPath, 'utf-8');
        const settings = JSON.parse(raw);
        const mcpServers = settings.mcpServers ?? {};
        // Check each configured MCP server
        for (const [name, entry] of Object.entries(mcpServers)) {
            const status = {
                name,
                type: entry.type || 'unknown',
                url: entry.type === 'sse' || entry.type === 'http' ? entry.url : undefined,
                command: entry.type === 'stdio' ? entry.command : undefined,
                disabled: entry.disabled === true,
                connected: false,
                lastChecked: now,
            };
            // Skip disabled servers — treat as "disconnected" with note
            if (entry.disabled) {
                status.error = 'Server is disabled';
                servers.push(status);
                continue;
            }
            // SSE/HTTP: send MCP ping
            if ((entry.type === 'sse' || entry.type === 'http') && entry.url) {
                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 3000);
                    const resp = await fetch(entry.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
                        body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', params: {}, id: 1 }),
                        signal: controller.signal,
                    });
                    clearTimeout(timeout);
                    if (resp.ok) {
                        const text = await resp.text();
                        status.connected = text.includes('data:') || (resp.headers.get('content-type')?.includes('text/event-stream') ?? false);
                        if (!status.connected)
                            status.error = 'Invalid SSE response';
                    }
                    else {
                        status.error = `HTTP ${resp.status}`;
                    }
                }
                catch (err) {
                    status.error = err.message || 'Connection failed';
                }
            }
            // stdio: check if command exists on PATH
            if (entry.type === 'stdio' && entry.command) {
                try {
                    const { execSync } = await import('child_process');
                    const isWin = process.platform === 'win32';
                    const checkCmd = isWin ? `where ${entry.command.split(' ')[0]} 2>nul` : `which ${entry.command.split(' ')[0]} 2>/dev/null`;
                    const out = execSync(checkCmd, { timeout: 2000, stdio: 'pipe', shell: isWin ? 'cmd.exe' : '/bin/sh' }).toString().trim();
                    status.connected = out.length > 0;
                    if (!status.connected)
                        status.error = `Command not found: ${entry.command}`;
                }
                catch {
                    status.error = `Command check failed: ${entry.command}`;
                }
            }
            servers.push(status);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ servers, timestamp: now }));
    }
    catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Status check failed: ${err.message}`, servers: [], timestamp: now }));
    }
}
/**
 * GET /api/qmd/status
 * Checks whether the qmd CLI is installed on the system, and whether
 * it's already configured as an MCP server in AICore/settings.json.
 */
export async function handleQmdStatus(_req, res, aicoreDir) {
    const result = {
        installed: false,
        configuredAsMcp: false,
        message: '',
    };
    // 1. Check if qmd binary exists on PATH
    try {
        const { execSync } = await import('child_process');
        const isWindows = process.platform === 'win32';
        const checkCmd = isWindows ? 'where qmd 2>nul' : 'which qmd 2>/dev/null';
        const pathOutput = execSync(checkCmd, { timeout: 3000, stdio: 'pipe', shell: isWindows ? 'cmd.exe' : '/bin/sh' })
            .toString().trim();
        if (pathOutput) {
            result.installed = true;
            result.command = pathOutput.split('\n')[0]?.trim();
            // 2. Get version
            try {
                const versionOutput = execSync('qmd --version 2>&1 || qmd version 2>&1', {
                    timeout: 5000, stdio: 'pipe', shell: isWindows ? 'cmd.exe' : '/bin/sh',
                }).toString().trim();
                const versionMatch = versionOutput.match(/(\d+\.\d+\.\d+)/);
                if (versionMatch)
                    result.version = versionMatch[1];
            }
            catch {
                // Version check is best-effort
            }
        }
    }
    catch {
        result.installed = false;
    }
    // 3. Check if qmd is already configured as an MCP server
    const settingsPath = join(aicoreDir, 'settings.json');
    try {
        if (existsSync(settingsPath)) {
            const raw = readFileSync(settingsPath, 'utf-8');
            const settings = JSON.parse(raw);
            if (settings.mcpServers) {
                for (const [name, entry] of Object.entries(settings.mcpServers)) {
                    if (entry.command === 'qmd' ||
                        (entry.command && entry.command.toLowerCase().includes('qmd'))) {
                        result.configuredAsMcp = true;
                        result.mcpServerName = name;
                        break;
                    }
                }
            }
        }
    }
    catch {
        // Best-effort check
    }
    // 4. Build human-readable message
    if (result.installed && result.configuredAsMcp) {
        result.message = result.version
            ? `QMD v${result.version} is installed and configured (${result.mcpServerName}). Local search is active.`
            : `QMD is installed and configured (${result.mcpServerName}). Local search is active.`;
    }
    else if (result.installed) {
        result.message = result.version
            ? `QMD v${result.version} is installed but not configured as an MCP server. Click to add.`
            : `QMD is installed but not configured as an MCP server. Click to add.`;
    }
    else {
        result.message = 'QMD is not installed. Install it for local semantic search over your project docs.';
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
}
//# sourceMappingURL=mcp.js.map