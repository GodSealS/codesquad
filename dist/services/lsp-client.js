/**
 * LSP Client — simplified Language Server Protocol client for diagnostics.
 *
 * Starts a tsserver process, sends didOpen/didChange, and collects
 * publishDiagnostics notifications. Focused on TypeScript diagnostics
 * for post-edit validation in the agent loop.
 *
 * References:
 *   Claude Code src/services/lsp/LSPClient.ts (14KB)
 *   Claude Code src/services/lsp/LSPServerInstance.ts (17KB)
 *   Claude Code src/services/lsp/LSPDiagnosticRegistry.ts (12KB)
 *
 * Phase 6 — P5 Vibe Coding
 */
import { spawn } from 'child_process';
import { createInterface } from 'readline';
// ── Constants ──
const INIT_TIMEOUT_MS = 10_000;
const DIAGNOSTIC_TIMEOUT_MS = 5_000;
const TSSERVER_COMMAND = 'npx';
const TSSERVER_ARGS = ['-y', 'typescript-language-server', '--stdio'];
// ── Client State ──
let _process = null;
let _nextId = 1;
let _initialized = false;
let _readline = null;
const _pendingRequests = new Map();
let _diagnostics = [];
let _projectRoot = '';
// ── JSON-RPC Transport ──
function sendRequest(method, params) {
    if (!_process || !_process.stdin) {
        return Promise.reject(new Error('LSP client not started'));
    }
    const id = _nextId++;
    const message = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    _process.stdin.write(`Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`);
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            _pendingRequests.delete(id);
            reject(new Error(`LSP request timeout: ${method}`));
        }, DIAGNOSTIC_TIMEOUT_MS);
        _pendingRequests.set(id, {
            resolve: (v) => { clearTimeout(timer); resolve(v); },
            reject: (e) => { clearTimeout(timer); reject(e); },
        });
    });
}
function sendNotification(method, params) {
    if (!_process || !_process.stdin)
        return;
    const message = JSON.stringify({ jsonrpc: '2.0', method, params });
    _process.stdin.write(`Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`);
}
// ── Response Parser ──
function parseLspFrames(chunk) {
    const results = [];
    let pos = 0;
    while (pos < chunk.length) {
        const headerEnd = chunk.indexOf('\r\n\r\n', pos);
        if (headerEnd === -1)
            break;
        const header = chunk.slice(pos, headerEnd);
        const contentLengthMatch = header.match(/Content-Length: (\d+)/i);
        if (!contentLengthMatch)
            break;
        const contentLength = parseInt(contentLengthMatch[1], 10);
        const bodyStart = headerEnd + 4;
        const bodyEnd = bodyStart + contentLength;
        if (bodyEnd > chunk.length)
            break; // Incomplete frame
        try {
            const body = chunk.slice(bodyStart, bodyEnd);
            const parsed = JSON.parse(body);
            results.push(parsed);
        }
        catch {
            // Skip malformed frames
        }
        pos = bodyEnd;
    }
    return results;
}
// ── Initialize ──
export async function startLspClient(projectRoot) {
    if (_initialized && _projectRoot === projectRoot)
        return;
    // Stop existing client if any
    await stopLspClient();
    _projectRoot = projectRoot;
    return new Promise((resolve, reject) => {
        const initTimer = setTimeout(() => {
            reject(new Error('LSP client init timeout'));
        }, INIT_TIMEOUT_MS);
        try {
            _process = spawn(TSSERVER_COMMAND, TSSERVER_ARGS, {
                cwd: projectRoot,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env },
                shell: true,
            });
        }
        catch (err) {
            clearTimeout(initTimer);
            reject(new Error(`Failed to spawn LSP server: ${err.message}`));
            return;
        }
        _process.on('error', (err) => {
            if (!_initialized) {
                clearTimeout(initTimer);
                reject(new Error(`LSP server error: ${err.message}`));
            }
        });
        _process.on('exit', (code) => {
            _initialized = false;
            if (code !== 0 && code !== null) {
                console.error(`[lsp] Server exited with code ${code}`);
            }
        });
        // Set up stdout reader for responses
        if (_process.stdout) {
            _readline = createInterface({ input: _process.stdout, crlfDelay: Infinity });
            let buffer = '';
            _readline.on('line', (line) => {
                buffer += line + '\r\n';
                // Check for Content-Length header
                if (buffer.includes('Content-Length:')) {
                    const frames = parseLspFrames(buffer);
                    for (const frame of frames) {
                        handleMessage(frame);
                    }
                    // Keep remaining incomplete data
                    const lastHeaderEnd = buffer.lastIndexOf('\r\n\r\n');
                    if (lastHeaderEnd !== -1) {
                        const lastMatch = buffer.slice(lastHeaderEnd).match(/Content-Length: (\d+)/i);
                        if (lastMatch) {
                            const len = parseInt(lastMatch[1], 10);
                            const remaining = buffer.length - lastHeaderEnd - 4;
                            if (remaining < len) {
                                buffer = buffer.slice(lastHeaderEnd);
                                return;
                            }
                        }
                    }
                    buffer = '';
                }
            });
        }
        // Handle stderr
        if (_process.stderr) {
            _process.stderr.on('data', (data) => {
                console.error(`[lsp:stderr] ${data.toString().slice(0, 200)}`);
            });
        }
        // Perform LSP initialization handshake
        (async () => {
            try {
                const rootUri = `file://${projectRoot.replace(/\\/g, '/')}`;
                const initResult = await sendRequest('initialize', {
                    processId: process.pid,
                    rootPath: projectRoot,
                    rootUri,
                    capabilities: {
                        textDocument: { publishDiagnostics: {} },
                        workspace: { diagnostics: {} },
                    },
                    workspaceFolders: [{ uri: rootUri, name: 'workspace' }],
                });
                sendNotification('initialized', {});
                _initialized = true;
                clearTimeout(initTimer);
                resolve();
            }
            catch (err) {
                clearTimeout(initTimer);
                reject(err);
            }
        })();
    });
}
function handleMessage(msg) {
    // Check for response to a pending request
    if (msg.id !== undefined && msg.id !== null) {
        const pending = _pendingRequests.get(msg.id);
        if (pending) {
            _pendingRequests.delete(msg.id);
            if (msg.error) {
                pending.reject(new Error(`LSP error: ${JSON.stringify(msg.error)}`));
            }
            else {
                pending.resolve(msg.result);
            }
        }
        return;
    }
    // Check for publishDiagnostics notification
    if (msg.method === 'textDocument/publishDiagnostics') {
        const params = msg.params;
        if (params) {
            const filePath = params.uri.startsWith('file://')
                ? params.uri.slice(7).replace(/\//g, require('path').sep)
                : params.uri;
            const diags = (params.diagnostics || []).map((d) => ({
                filePath,
                line: (d.range.start.line || 0) + 1,
                character: (d.range.start.character || 0) + 1,
                message: d.message,
                severity: mapLspSeverity(d.severity),
                source: d.source,
                code: String(d.code ?? ''),
            }));
            // Merge: replace diagnostics for this file
            _diagnostics = [
                ..._diagnostics.filter((d) => d.filePath !== filePath),
                ...diags,
            ];
        }
        return;
    }
}
function mapLspSeverity(severity) {
    switch (severity) {
        case 1: return 'error';
        case 2: return 'warning';
        case 3: return 'info';
        case 4: return 'hint';
        default: return 'info';
    }
}
// ── File Operations ──
export async function openFile(filePath, content) {
    if (!_initialized)
        return;
    const uri = `file://${filePath.replace(/\\/g, '/')}`;
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const languageIdMap = {
        ts: 'typescript',
        tsx: 'typescriptreact',
        js: 'javascript',
        jsx: 'javascriptreact',
        json: 'json',
        css: 'css',
        html: 'html',
    };
    const languageId = languageIdMap[ext] || 'plaintext';
    try {
        sendNotification('textDocument/didOpen', {
            textDocument: { uri, languageId, version: 1, text: content },
        });
    }
    catch {
        // Ignore notification errors
    }
}
export async function changeFile(filePath, content) {
    if (!_initialized)
        return;
    const uri = `file://${filePath.replace(/\\/g, '/')}`;
    try {
        sendNotification('textDocument/didChange', {
            textDocument: { uri, version: 1 },
            contentChanges: [{ text: content }],
        });
    }
    catch {
        // Fallback: didOpen instead
        await openFile(filePath, content);
    }
}
// ── Diagnostics ──
export async function getDiagnostics(filePath) {
    if (!_initialized)
        return [];
    // Return cached diagnostics for this file
    return _diagnostics.filter((d) => d.filePath === filePath);
}
export function getAllDiagnostics() {
    return _diagnostics;
}
export function clearDiagnostics(filePath) {
    if (filePath) {
        _diagnostics = _diagnostics.filter((d) => d.filePath !== filePath);
    }
    else {
        _diagnostics = [];
    }
}
export function isLspReady() {
    return _initialized;
}
// ── Shutdown ──
export async function stopLspClient() {
    if (_process) {
        try {
            sendRequest('shutdown');
            sendNotification('exit');
        }
        catch {
            // Server may already be gone
        }
        _process.kill('SIGTERM');
        _process = null;
    }
    if (_readline) {
        _readline.close();
        _readline = null;
    }
    _initialized = false;
    _nextId = 1;
    _diagnostics = [];
    _pendingRequests.clear();
    _projectRoot = '';
}
//# sourceMappingURL=lsp-client.js.map