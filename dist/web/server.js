/**
 * CodeSquad Web Console — HTTP Server.
 *
 * Serves the Web Console SPA and REST API. Shares session store
 * with the REPL via ~/.codesquad/sessions/.
 *
 * Architecture:
 *   GET  /                → Static SPA (index.html)
 *   GET  /login?token=...  → Auth cookie
 *   GET  /api/*            → REST API (Bearer auth)
 *   POST /api/chat         → SSE streaming
 *   GET  /healthz          → Health check (no auth)
 */
import { createServer } from 'http';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { virtualExists, virtualReadFile } from '../embedded/virtual-fs.js';
import { readEmbeddedFile, isBunCompiled } from '../embedded/runtime.js';
import { generateToken, checkAuth, handleLogin, setAuthEnabled } from './middleware/auth.js';
import { handleSessions } from './routes/sessions.js';
import { handleChatV2, handleChatStream, handlePermissionResponse } from './routes/chat-v2.js';
import { handleOptimizePrompt } from './routes/optimize-prompt.js';
import { handleAgents, handleSkills } from './routes/agents.js';
import { handleUsage } from './routes/usage.js';
import { handleProviders } from './routes/providers.js';
import { handleProject } from './routes/project.js';
import { handleFiles } from './routes/files.js';
import { handleModelsConfig } from './routes/models-config.js';
import { handleWorkspaceFiles } from './routes/workspace-files.js';
import { handleFileList } from './routes/file-list.js';
import { handleMcpGet, handleMcpPost, handleMcpReload, handleMcpVerify, handleMcpStatus, handleQmdStatus } from './routes/mcp.js';
import { handleModels, handleModelsVerify } from './routes/models.js';
import { handleCacheCleanup } from './routes/cache-cleanup.js';
// ── Tool initialization (shared with agent-runner) ──
import { registerTools } from '../tools/registry.js';
import { BashTool } from '../tools/BashTool.js';
import { FileReadTool } from '../tools/FileReadTool.js';
import { FileWriteTool } from '../tools/FileWriteTool.js';
import { FileEditTool } from '../tools/FileEditTool.js';
import { GrepTool, GlobTool } from '../tools/GrepGlobTool.js';
import { AgentTool } from '../tools/AgentTool.js';
import { TodoWriteTool } from '../tools/TodoWriteTool.js';
import { TaskCreateTool } from '../tools/TaskCreateTool.js';
import { TaskGetTool } from '../tools/TaskGetTool.js';
import { TaskListTool } from '../tools/TaskListTool.js';
import { TaskStopTool } from '../tools/TaskStopTool.js';
import { TeamCreateTool } from '../tools/TeamCreateTool.js';
import { TeamDeleteTool } from '../tools/TeamDeleteTool.js';
import { SendMessageTool } from '../tools/SendMessageTool.js';
import { WebSearchTool } from '../tools/WebSearchTool.js';
import { WebFetchTool } from '../tools/WebFetchTool.js';
import { AskUserQuestionTool } from '../tools/AskUserQuestionTool.js';
import { EnterPlanModeTool } from '../tools/EnterPlanModeTool.js';
import { ExitPlanModeTool } from '../tools/ExitPlanModeTool.js';
import { LSPTool } from '../tools/LSPTool.js';
import { SkillTool } from '../tools/SkillTool.js';
import { ToolSearchTool } from '../tools/ToolSearchTool.js';
import { loadAICoreConfig } from '../config/aicore-config.js';
import { initHooksFromAICore } from '../hooks/config-loader.js';
import { initErrorLogger } from '../utils/error-logger.js';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PKG_ROOT = join(__dirname, '..', '..');
const WEB_CONSOLE_DIR = join(PKG_ROOT, 'UI', 'web-console');
const AICORE_DIR = join(PKG_ROOT, 'AICore');
/** Initialize builtin tools and permissions (does NOT depend on project root). */
function initBuiltinToolsAndPermissions() {
    // Register all 19 builtin tools (mirrors REPL tool pool)
    registerTools([
        BashTool, FileReadTool, FileWriteTool, FileEditTool, GrepTool, GlobTool,
        AgentTool, TodoWriteTool,
        TaskCreateTool, TaskGetTool, TaskListTool, TaskStopTool,
        TeamCreateTool, TeamDeleteTool, SendMessageTool,
        AskUserQuestionTool,
        WebSearchTool, WebFetchTool,
        EnterPlanModeTool, ExitPlanModeTool,
        LSPTool, SkillTool, ToolSearchTool,
    ]);
    // Init permissions from AICore/settings.json
    loadAICoreConfig(AICORE_DIR);
}
/** Init hooks + MCP from project-specific .codesquad/settings.json */
async function initProjectSettings(codesquadDir) {
    initHooksFromAICore(codesquadDir);
    try {
        const { loadAndRegisterMCPTools } = await import('../repl/index.js');
        await loadAndRegisterMCPTools(codesquadDir);
    }
    catch {
        console.log('[web] MCP tools not loaded (non-critical)');
    }
}
// ═══════════════════════════════════════════════
// Static file serving
// ═══════════════════════════════════════════════
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};
function serveStatic(req, res) {
    const rawUrl = req.url ?? '/';
    // Strip query string
    const urlPath = rawUrl.split('?')[0] ?? '/';
    if (urlPath === '/login')
        return false; // handled separately
    // ── Bun-compiled mode: embedded data first ──
    if (isBunCompiled) {
        const embeddedKey = (urlPath === '/' || urlPath === '')
            ? 'UI/web-console/index.html'
            : `UI/web-console${urlPath}`;
        let content = readEmbeddedFile(embeddedKey);
        let resolvedPath = embeddedKey;
        // SPA fallback: serve index.html for unmatched routes
        if (content === null) {
            content = readEmbeddedFile('UI/web-console/index.html');
            resolvedPath = 'UI/web-console/index.html';
        }
        if (content === null) {
            res.writeHead(404);
            res.end('Not Found');
            return true;
        }
        const ext = extname(resolvedPath).toLowerCase();
        const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
        const headers = { 'Content-Type': contentType };
        if (ext === '.html') {
            headers['Content-Security-Policy'] =
                "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
                    "connect-src 'self'; img-src 'self' data:; font-src 'self'; " +
                    "frame-src 'none'; object-src 'none';";
        }
        res.writeHead(200, headers);
        res.end(content);
        return true;
    }
    // ── Filesystem mode (npm/dev) ──
    let filePath;
    if (urlPath === '/' || urlPath === '') {
        filePath = join(WEB_CONSOLE_DIR, 'index.html');
    }
    else {
        filePath = join(WEB_CONSOLE_DIR, urlPath);
    }
    // Prevent directory traversal
    const normalized = filePath.replace(/\\/g, '/');
    const base = WEB_CONSOLE_DIR.replace(/\\/g, '/');
    if (!normalized.startsWith(base)) {
        return false;
    }
    // VirtualFS: embedded-first, filesystem-fallback
    if (!virtualExists(filePath)) {
        // SPA fallback: serve index.html for any unmatched route
        filePath = join(WEB_CONSOLE_DIR, 'index.html');
        if (!virtualExists(filePath)) {
            res.writeHead(404);
            res.end('Not Found');
            return true;
        }
    }
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
    try {
        const content = virtualReadFile(filePath); // returns Buffer for binary or string
        const headers = { 'Content-Type': contentType };
        // CSP for HTML pages
        if (ext === '.html') {
            headers['Content-Security-Policy'] =
                "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
                    "connect-src 'self'; img-src 'self' data:; font-src 'self'; " +
                    "frame-src 'none'; object-src 'none';";
        }
        res.writeHead(200, headers);
        res.end(content);
        return true;
    }
    catch {
        res.writeHead(500);
        res.end('Internal Server Error');
        return true;
    }
}
// ═══════════════════════════════════════════════
// CORS
// ═══════════════════════════════════════════════
function setCorsHeaders(req, res) {
    const origin = req.headers.origin;
    // B3 fix: never set '*' when credentials are enabled (violates CORS spec).
    // When origin is absent (non-browser requests), omit it entirely.
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
export async function startWebServer(options) {
    const token = options.authToken ?? generateToken();
    if (options.noAuth)
        setAuthEnabled(false);
    const projectRoot = process.cwd();
    const codesquadDir = join(projectRoot, '.codesquad');
    // ── Initialize error logger (local file + optional email) ──
    initErrorLogger(projectRoot);
    // ── Initialize tools, permissions, hooks, and MCP BEFORE accepting requests ──
    initBuiltinToolsAndPermissions();
    await initProjectSettings(codesquadDir);
    const server = createServer(async (req, res) => {
        setCorsHeaders(req, res);
        // Handle preflight
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        const reqPath = req.url?.split('?')[0] ?? '/';
        // ── Login endpoint (no auth required) ──
        if (reqPath === '/login') {
            if (handleLogin(req, res))
                return;
            // No valid token param → serve login page
            const loginHtml = join(WEB_CONSOLE_DIR, 'login.html');
            if (virtualExists(loginHtml)) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(virtualReadFile(loginHtml));
            }
            else {
                // Inline login form (no login.html needed)
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>CodeSquad — Login</title><style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;font-family:system-ui,-apple-system,sans-serif;color:#e2e8f0}.card{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px;max-width:400px;width:90%;text-align:center}.card h1{font-size:20px;margin:0 0 8px}.card p{font-size:14px;color:#94a3b8;margin:0 0 20px}#token{width:100%;padding:10px 12px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:14px;font-family:monospace;box-sizing:border-box;margin-bottom:12px}#token:focus{outline:2px solid #6366f1}#submit{width:100%;padding:10px;border-radius:8px;border:none;background:#6366f1;color:white;font-size:14px;font-weight:600;cursor:pointer}#submit:hover{background:#4f46e5}.error{color:#f87171;font-size:13px;margin-top:8px;display:none}</style></head><body><div class="card"><h1>🔑 CodeSquad Web Console</h1><p>Copy the token from your terminal to log in</p><form onsubmit="event.preventDefault();window.location.href=location.pathname+'?token='+document.getElementById('token').value;" method="get"><input id="token" type="text" placeholder="Paste your token here…" autofocus><button id="submit" type="submit">Login</button></form><div class="error" id="error"></div></div></body></html>`);
            }
            return;
        }
        // ── Health check (no auth required) ──
        if (reqPath === '/healthz') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', projectRoot }));
            return;
        }
        // ── API routes ──
        if (reqPath.startsWith('/api/')) {
            if (!checkAuth(req, res))
                return;
            const method = req.method ?? 'GET';
            try {
                if (reqPath.startsWith('/api/sessions')) {
                    await handleSessions(req, res, { projectRoot }, reqPath, method);
                    return;
                }
                if (reqPath === '/api/chat' && method === 'POST') {
                    // Route to v2 handler (new React UI) — supports { prompt, history, modelName, ... }
                    await handleChatV2(req, res);
                    return;
                }
                if (reqPath === '/api/chat/stream' && method === 'POST') {
                    // Feature 3 (P5): SSE streaming endpoint for vibe coding
                    await handleChatStream(req, res);
                    return;
                }
                if (reqPath === '/api/chat/respond-permission' && method === 'POST') {
                    // Feature 7 (P5): Permission response for tool calls
                    await handlePermissionResponse(req, res);
                    return;
                }
                if (reqPath === '/api/optimize-prompt' && method === 'POST') {
                    await handleOptimizePrompt(req, res);
                    return;
                }
                if (reqPath.startsWith('/api/agents')) {
                    await handleAgents(req, res, { projectRoot }, reqPath);
                    return;
                }
                if (reqPath.startsWith('/api/skills')) {
                    await handleSkills(req, res, { projectRoot }, reqPath);
                    return;
                }
                if (reqPath === '/api/models') {
                    await handleModels(req, res);
                    return;
                }
                if (reqPath === '/api/models/verify' && method === 'POST') {
                    await handleModelsVerify(req, res);
                    return;
                }
                if (reqPath === '/api/usage') {
                    await handleUsage(req, res, { projectRoot });
                    return;
                }
                if (reqPath === '/api/cache/cleanup') {
                    await handleCacheCleanup(req, res);
                    return;
                }
                if (reqPath === '/api/providers') {
                    await handleProviders(req, res, { projectRoot });
                    return;
                }
                if (reqPath === '/api/project') {
                    await handleProject(req, res, { projectRoot });
                    return;
                }
                if (reqPath.startsWith('/api/files/list')) {
                    await handleFileList(req, res, { projectRoot });
                    return;
                }
                if (reqPath.startsWith('/api/files')) {
                    await handleFiles(req, res, { projectRoot }, reqPath, method);
                    return;
                }
                if (reqPath === '/api/models-config') {
                    await handleModelsConfig(req, res, { projectRoot }, reqPath, method);
                    return;
                }
                if (reqPath === '/api/mcp/servers') {
                    if (method === 'GET')
                        await handleMcpGet(req, res, codesquadDir);
                    else if (method === 'POST')
                        await handleMcpPost(req, res, codesquadDir);
                    else {
                        res.writeHead(405);
                        res.end(JSON.stringify({ error: 'Method not allowed' }));
                    }
                    return;
                }
                if (reqPath === '/api/mcp/reload' && method === 'POST') {
                    await handleMcpReload(req, res, codesquadDir);
                    return;
                }
                if (reqPath === '/api/mcp/verify' && method === 'POST') {
                    await handleMcpVerify(req, res);
                    return;
                }
                if (reqPath === '/api/mcp/status' && method === 'GET') {
                    await handleMcpStatus(req, res, codesquadDir);
                    return;
                }
                if (reqPath === '/api/qmd/status' && method === 'GET') {
                    await handleQmdStatus(req, res, codesquadDir);
                    return;
                }
                if (reqPath.startsWith('/api/workspace/')) {
                    await handleWorkspaceFiles(req, res, { projectRoot }, reqPath, method);
                    return;
                }
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'API endpoint not found' }));
                return;
            }
            catch (err) {
                console.error(`[web] API error ${reqPath}:`, err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
                return;
            }
        }
        // ── Static files ──
        serveStatic(req, res);
    });
    server.listen(options.port, options.bind, () => {
        console.log(`\n  ✅ Web Console started on http://${options.bind}:${options.port}`);
    });
    return { server, token, port: options.port };
}
//# sourceMappingURL=server.js.map