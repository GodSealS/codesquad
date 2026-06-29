/**
 * CodeSquad Terminal REPL — Main entry point.
 *
 * Launches an interactive readline-based REPL that supports:
 *   @agent-name → invoke an agent for conversation via LLM
 *   /skill-name → invoke a skill via MCP
 *   /cmd        → builtin command handler
 *
 * Pipeline: User input → readline → parser → LLM/MCP → display → session save
 */
import { createInterface, emitKeypressEvents } from 'readline';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { virtualExists, virtualReadFile, virtualReadDir } from '../embedded/virtual-fs.js';
import { readEmbeddedFile } from '../embedded/runtime.js';
import { parseInput } from './parser.js';
import { renderBanner, renderProviderStatus, renderHelp, renderTokenUsage, errorLine, warnLine, okLine, infoLine, separator, startSpinner, stopSpinner, renderFormattedContent, } from './display.js';
import { createEditor, enterEditMode, appendLine, getFullText, cancelEdit, isInEditMode, editPrompt, getSubmitFallbackHint, } from './editor.js';
import { resolveKeyAction } from './keybinds.js';
// Mode system
import { createDefaultModeState, } from './mode.js';
import { renderModeBadge } from './mode-display.js';
import { handleModeCommand, cycleMode, getModeTransitionMessage, confirmCraftMode, } from './mode-handler.js';
import { persistModeToSession, restoreModeFromSession } from './mode-persist.js';
// Skill registry (Claude Code alignment)
import { setAicodeRoot, loadSkill, listSkills as listRegistrySkills, filterUserInvocable } from './skill-registry.js';
// Chat
import { createSession, save, load, listSessions, findSessionById, addMessage, deleteMessage, getRecentMessages } from '../chat/session.js';
import { exportSession } from '../chat/import-export.js';
// Cross-chat memory
import { summarizeHistory, formatHistorySummary } from '../chat/memory-summarizer.js';
import { loadSettings, saveSettings, getMemoryLimit } from '../chat/settings.js';
import { estimateTokenCount } from '../chat/tokenizer.js';
import { computeBudget } from '../chat/budget.js';
// LLM
import { getProvider, listProviders, buildRuntimeConfig, resolveApiKey } from '../llm/registry.js';
import { callLLM, LlmError } from '../llm/client.js';
import { detectOllama, registerOllamaProvider } from '../llm/fallback.js';
import { recordUsage, getMonthlyUsage, getTotalCost, getBudget } from '../llm/usage-tracker.js';
// Keyring
import { storeKey, isKeyringAvailable } from '../llm/keyring.js';
// Tools (Phase 1)
import { registerTools as registerToolPool, registerTool, getToolPool, findTool } from '../tools/registry.js';
import { BashTool } from '../tools/BashTool.js';
import { FileReadTool } from '../tools/FileReadTool.js';
import { FileWriteTool } from '../tools/FileWriteTool.js';
import { FileEditTool } from '../tools/FileEditTool.js';
import { GrepTool, GlobTool } from '../tools/GrepGlobTool.js';
import { AgentTool } from '../tools/AgentTool.js';
import { TodoWriteTool } from '../tools/TodoWriteTool.js';
// Feature 2 (P4): Task system tools
import { TaskCreateTool } from '../tools/TaskCreateTool.js';
import { TaskGetTool } from '../tools/TaskGetTool.js';
import { TaskListTool } from '../tools/TaskListTool.js';
import { TaskStopTool } from '../tools/TaskStopTool.js';
// Feature 3 (P4): Team collaboration tools
import { TeamCreateTool } from '../tools/TeamCreateTool.js';
import { TeamDeleteTool } from '../tools/TeamDeleteTool.js';
import { SendMessageTool } from '../tools/SendMessageTool.js';
// Feature 1 (P5): Vibe Coding tools
import { AskUserQuestionTool } from '../tools/AskUserQuestionTool.js';
// Feature 2 (P5): Web tools
import { WebSearchTool } from '../tools/WebSearchTool.js';
import { WebFetchTool } from '../tools/WebFetchTool.js';
// Feature 5 (P5): Plan mode tools
import { EnterPlanModeTool } from '../tools/EnterPlanModeTool.js';
import { ExitPlanModeTool } from '../tools/ExitPlanModeTool.js';
// Feature 6 (P5): LSP diagnostics
import { LSPTool } from '../tools/LSPTool.js';
// Skill & Tool Search (Phase 4 — Chat Feature Gap Fill)
import { SkillTool } from '../tools/SkillTool.js';
import { ToolSearchTool } from '../tools/ToolSearchTool.js';
import { clearSessionCache } from '../tools/file-state.js';
// Skill instance system (P0 — step-by-step execution with pause/resume)
import { SkillInstance } from '../skills/instance.js';
import { skillInstances } from '../skills/manager.js';
import { initHooksFromAICore } from '../hooks/config-loader.js';
import { executeSessionStartHooks, executeStopHooks, resetHookState } from '../hooks/executor.js';
import { loadSandboxConfig } from '../permissions/sandbox.js';
// MCP Bridge (Phase 7.0) — wire MCP tools into the tool pool
import { createMCPToolWrapper, registerMCPToolHandler } from '../tools/MCPBridge.js';
// Prompt Builder (Phase 3)
import { clearSystemPromptCache as clearPromptCache } from '../prompt/builder.js';
import { invalidateProjectGuidance, setGlobalGuidanceFlags } from '../prompt/builtin-sections.js';
import { loadAllAgentsLayered, findAgent } from '../agents/definition.js';
// Status Line (Phase 7.2)
import { getStatusLine, formatStatusLine } from './statusline.js';
// CLI flags (Phase P3.2)
import { parseFlags } from '../cli/flags.js';
// Compact (Phase 4)
import { compactConversation, applyCompaction } from '../context/compact.js';
import { calculateContextStats, formatContextStats, recordCompaction } from '../context/monitor.js';
// Auto-Compact (Phase 6.1)
// (auto-compact now handled internally by SkillInstance and agent-runner)
// Init (project file reset)
import { installProjectFiles } from '../core/init-core.js';
// Model resolution (models.config.yaml)
import { resolveModel } from '../generators/model-resolver.js';
import { loadModelsConfig } from '../core/models.js';
// ── Version ──
const __dirname = dirname(fileURLToPath(import.meta.url));
const AICORE_DIR = join(__dirname, '..', '..', 'AICore');
const PROJECT_ROOT = join(__dirname, '..', '..');
// Read version with embedded mode fallback (Bun compile)
function getReplPkg() {
    try {
        const raw = readEmbeddedFile('package.json');
        if (raw)
            return JSON.parse(raw);
    }
    catch { /* fall through */ }
    try {
        return JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));
    }
    catch {
        return { version: '0.1.0' };
    }
}
const pkg = getReplPkg();
/** Load models.config.yaml once at startup. */
let _modelsConfigCache = null;
function getModelsConfig() {
    if (!_modelsConfigCache) {
        _modelsConfigCache = loadModelsConfig(PROJECT_ROOT);
    }
    return _modelsConfigCache;
}
// Initialize skill registry with AICore root (before startRepl is called)
setAicodeRoot(AICORE_DIR);
// ── CLI flag helpers (P3) ──
/** Convert CLI --permission-mode value (default|acceptEdits|bypassPermissions|plan) to ChatMode. */
function permissionModeToChatModeState(raw) {
    switch (raw.toLowerCase()) {
        case 'default':
        case 'dontask':
            return 'ask';
        case 'acceptedits':
        case 'bypasspermissions':
            return 'craft';
        case 'plan':
            return 'plan';
        default:
            return 'ask';
    }
}
// ── MCP Tool Loading (Phase 7.0 / P0 fix) ──
/**
 * Load MCP server configurations and register their tools.
 * Reads from AICore/settings.json mcpServers block (if present),
 * or from Config/mcp.config.yaml fallback.
 *
 * Mirrors Claude Code's MCP client initialization in bootstrap.
 */
export async function loadAndRegisterMCPTools(aicoreDir) {
    // Try loading MCP server configs from AICore/settings.json
    const settingsPath = join(aicoreDir, 'settings.json');
    let mcpServers = [];
    try {
        if (existsSync(settingsPath)) {
            const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
            if (settings.mcpServers && typeof settings.mcpServers === 'object') {
                mcpServers = Object.entries(settings.mcpServers).map(([name, cfg]) => ({
                    name,
                    command: cfg.command,
                    url: cfg.url,
                    args: cfg.args,
                    env: cfg.env,
                }));
            }
        }
    }
    catch {
        // Fall back to mcp.config.yaml (virtual-fs for embedded support)
        try {
            const { parse } = await import('yaml');
            const configPath = join(PROJECT_ROOT, 'Config', 'mcp.config.yaml');
            if (virtualExists(configPath)) {
                const raw = virtualReadFile(configPath, 'utf-8');
                const config = parse(raw);
                if (config?.servers) {
                    mcpServers = Object.entries(config.servers).map(([name, cfg]) => ({
                        name,
                        command: cfg.command,
                        url: cfg.url,
                        args: cfg.args,
                        env: cfg.env,
                    }));
                }
            }
        }
        catch { /* config file missing or invalid — skip */ }
    }
    if (mcpServers.length === 0)
        return;
    // For each MCP server, discover and register its tools
    for (const server of mcpServers) {
        try {
            // Discover tools from the MCP server (via stdio or HTTP SSE)
            const tools = await discoverMCPTools(server);
            if (tools.length === 0)
                continue;
            for (const mcpTool of tools) {
                // Register the tool handler
                registerMCPToolHandler(server.name, mcpTool.name, async (input) => {
                    return invokeMCPToolViaTransport(server, mcpTool.name, input);
                });
                // Create and register the CodeSquad Tool wrapper
                const tool = createMCPToolWrapper(mcpTool, server.name);
                registerTool(tool);
            }
        }
        catch {
            // Server unavailable — skip gracefully, tools just won't be available
        }
    }
}
/**
 * Discover tools available on an MCP server via its transport.
 * Returns empty array if server is unreachable.
 */
async function discoverMCPTools(server) {
    if (server.command) {
        // stdio transport — spawn and send tools/list
        return discoverMCPToolsViaStdio(server.command, server.args ?? [], server.env);
    }
    if (server.url) {
        // SSE/HTTP transport — fetch tools/list
        return discoverMCPToolsViaSSE(server.url, server.env);
    }
    return [];
}
/** Discover MCP tools via stdio (spawn child process). */
async function discoverMCPToolsViaStdio(command, args, env) {
    const { spawn } = await import('child_process');
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, ...env },
            windowsHide: true,
        });
        let buffer = '';
        const timer = setTimeout(() => {
            child.kill();
            resolve([]);
        }, 10000); // 10s timeout for tool discovery
        child.stdout?.on('data', (data) => {
            buffer += data.toString();
            // Try to parse complete JSON-RPC messages
            const lines = buffer.split('\n');
            for (const line of lines) {
                try {
                    const msg = JSON.parse(line.trim());
                    if (msg.id === 'tools-list-1' && msg.result?.tools) {
                        clearTimeout(timer);
                        child.kill();
                        resolve(msg.result.tools.map((t) => ({
                            name: t.name,
                            description: t.description || '',
                            inputSchema: t.inputSchema,
                        })));
                        return;
                    }
                }
                catch { /* incomplete line */ }
            }
        });
        child.on('error', () => {
            clearTimeout(timer);
            resolve([]);
        });
        child.on('exit', () => {
            clearTimeout(timer);
            resolve([]);
        });
        // Send initialize + tools/list
        child.stdin?.write(JSON.stringify({
            jsonrpc: '2.0', id: 'init-1', method: 'initialize',
            params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'codesquad', version: '0.1.0' } },
        }) + '\n');
        child.stdin?.write(JSON.stringify({
            jsonrpc: '2.0', id: 'tools-list-1', method: 'tools/list', params: {},
        }) + '\n');
    });
}
/** Discover MCP tools via SSE/HTTP. */
async function discoverMCPToolsViaSSE(url, _env) {
    try {
        const response = await fetch(`${url}/tools/list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 'tools-list-1', method: 'tools/list', params: {} }),
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok)
            return [];
        const data = await response.json();
        if (data.result?.tools) {
            return data.result.tools.map((t) => ({
                name: t.name,
                description: t.description || '',
                inputSchema: t.inputSchema,
            }));
        }
        return [];
    }
    catch {
        return [];
    }
}
/** Invoke an MCP tool through its native transport. */
async function invokeMCPToolViaTransport(server, toolName, input) {
    if (server.command) {
        return invokeMCPToolViaStdio(server.command, server.args ?? [], toolName, input, server.env);
    }
    if (server.url) {
        return invokeMCPToolViaSSE(server.url, toolName, input);
    }
    throw new Error(`No transport configured for MCP server "${server.name}"`);
}
async function invokeMCPToolViaStdio(command, args, toolName, input, env) {
    const { spawn } = await import('child_process');
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, ...env },
            windowsHide: true,
        });
        let buffer = '';
        const timer = setTimeout(() => { child.kill(); reject(new Error('MCP tool timeout')); }, 120000);
        child.stdout?.on('data', (data) => {
            buffer += data.toString();
            try {
                const msg = JSON.parse(buffer.trim());
                if (msg.id === 'call-1') {
                    clearTimeout(timer);
                    child.kill();
                    if (msg.error)
                        reject(new Error(msg.error.message));
                    else
                        resolve(msg.result?.content?.[0]?.text ?? msg.result);
                }
            }
            catch { /* incomplete */ }
        });
        child.on('error', (err) => { clearTimeout(timer); reject(err); });
        child.on('exit', () => { clearTimeout(timer); reject(new Error('MCP process exited unexpectedly')); });
        child.stdin?.write(JSON.stringify({ jsonrpc: '2.0', id: 'init-1', method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'codesquad', version: '0.1.0' } } }) + '\n');
        child.stdin?.write(JSON.stringify({ jsonrpc: '2.0', id: 'call-1', method: 'tools/call', params: { name: toolName, arguments: input } }) + '\n');
    });
}
async function invokeMCPToolViaSSE(url, toolName, input) {
    const response = await fetch(`${url}/tools/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'call-1', method: 'tools/call', params: { name: toolName, arguments: input } }),
        signal: AbortSignal.timeout(60000),
    });
    if (!response.ok)
        throw new Error(`MCP SSE error: ${response.status}`);
    const data = await response.json();
    if (data.error)
        throw new Error(data.error.message);
    return data.result?.content?.[0]?.text ?? data.result;
}
/**
 * Load MCP tools from an external config file (--mcp-config CLI flag).
 * Parses JSON or YAML, extracts server definitions, registers tools.
 */
async function loadAndRegisterMCPToolsFromPath(configPath) {
    const raw = readFileSync(configPath, 'utf-8');
    let servers = [];
    try {
        // Try YAML first
        const { parse } = await import('yaml');
        const config = parse(raw);
        servers = (config?.mcpServers || config?.servers || []).map((s) => ({
            name: s.name || s.id || 'unknown',
            command: s.command,
            url: s.url,
            args: s.args,
        }));
    }
    catch {
        // Try JSON
        try {
            const config = JSON.parse(raw);
            const entries = config?.mcpServers || config?.servers || {};
            servers = Object.entries(entries).map(([name, cfg]) => ({
                name,
                command: cfg.command,
                url: cfg.url,
                args: cfg.args,
            }));
        }
        catch {
            return;
        }
    }
    for (const server of servers) {
        try {
            const tools = await discoverMCPTools(server);
            for (const mcpTool of tools) {
                registerMCPToolHandler(server.name, mcpTool.name, async (input) => {
                    return invokeMCPToolViaTransport(server, mcpTool.name, input);
                });
                registerTool(createMCPToolWrapper(mcpTool, server.name));
            }
        }
        catch { /* skip unavailable */ }
    }
}
// ── Project guidance (Claude Code alignment: like CLAUDE.md + AICore/system config) ──
/**
 * Load project-level guidance from CODESQUAD.md (CLI config),
 * CODEBUDDY.md (IDE config), and AICore/CODESQUAD.md (system template).
 * Priority: .codesquad/CODESQUAD.md → project root CODESQUAD.md → CLI template
 * Mirrors Claude Code's loadMemoryPrompt() which reads CLAUDE.md + memory directory.
 */
function loadProjectGuidance() {
    const parts = [];
    // Rule 4: Read CODESQUAD.md from project locations first (dynamic, user-modifiable)
    const dotCodesquadMd = join(PROJECT_ROOT, '.codesquad', 'CODESQUAD.md');
    const projectRootMd = join(PROJECT_ROOT, 'CODESQUAD.md');
    for (const p of [dotCodesquadMd, projectRootMd]) {
        try {
            if (existsSync(p)) {
                parts.push(readFileSync(p, 'utf-8'));
                break;
            }
        }
        catch { /* try next */ }
    }
    // Rule 3: Fallback to CLI's AICore template (backward compat, VirtualFS)
    if (parts.length === 0) {
        const cliTemplate = join(AICORE_DIR, 'CODESQUAD.md');
        try {
            parts.push(virtualReadFile(cliTemplate, 'utf-8'));
        }
        catch { /* optional */ }
    }
    // CODEBUDDY.md for IDE context (engine, tech stack, conventions)
    const projectMd = join(PROJECT_ROOT, 'CODEBUDDY.md');
    try {
        parts.push(readFileSync(projectMd, 'utf-8'));
    }
    catch { /* optional */ }
    return parts.length > 0 ? parts.join('\n\n---\n\n') : null;
}
// ── Default model config ──
const DEFAULT_MODEL_CONFIG = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    temperature: 0.7,
};
/**
 * Resolve the effective model for an agent using models.config.yaml.
 * Priority: config agents.[name] > config batch mapping > config default > agent frontmatter model > hardcoded fallback
 */
function resolveAgentModel(agentName) {
    const modelsConfig = getModelsConfig();
    const agentDef = findAgent(agentName);
    const agentModel = agentDef?.model;
    const defaultModel = modelsConfig.default || DEFAULT_MODEL_CONFIG.model;
    if (agentModel) {
        // Resolve through batch mappings → default → original
        const resolved = resolveModel(agentModel, agentName, 'agent', modelsConfig);
        return {
            ...DEFAULT_MODEL_CONFIG,
            model: resolved,
        };
    }
    // No agent model → use config default or hardcoded fallback
    return {
        ...DEFAULT_MODEL_CONFIG,
        model: defaultModel,
    };
}
// ── Agent prompt loading ──
function loadAgentPrompt(agentName) {
    const agentPath = join(AICORE_DIR, 'agents', `${agentName}.md`);
    try {
        return virtualReadFile(agentPath, 'utf-8');
    }
    catch {
        return null;
    }
}
function agentExists(agentName) {
    return virtualExists(join(AICORE_DIR, 'agents', `${agentName}.md`));
}
// ── REPL loop ──
export async function startRepl() {
    // ── Set project-scoped storage (data lives under PROJECT_ROOT/.codesquad/) ──
    const { setProjectRoot } = await import('../chat/storage.js');
    const { setUsageProjectRoot } = await import('../llm/usage-tracker.js');
    const { setTaskStoreRoot } = await import('../tasks/store.js');
    setProjectRoot(PROJECT_ROOT);
    setUsageProjectRoot(PROJECT_ROOT);
    setTaskStoreRoot(PROJECT_ROOT);
    // ── Register tools (Phase 1) ──
    registerToolPool([
        BashTool, FileReadTool, FileWriteTool, FileEditTool, GrepTool, GlobTool, AgentTool, TodoWriteTool,
        // Feature 2 (P4): Task system
        TaskCreateTool, TaskGetTool, TaskListTool, TaskStopTool,
        // Feature 3 (P4): Team collaboration
        TeamCreateTool, TeamDeleteTool, SendMessageTool,
        // Feature 1 (P5): Ask user questions
        AskUserQuestionTool,
        // Feature 2 (P5): Web search/fetch
        WebSearchTool, WebFetchTool,
        // Feature 5 (P5): Plan mode
        EnterPlanModeTool, ExitPlanModeTool,
        // Feature 6 (P5): LSP diagnostics
        LSPTool,
        // Phase 4: Chat feature gap fill
        SkillTool, ToolSearchTool,
    ]);
    // ── Init permissions from AICore/settings.json (Phase 2 / 5.5) ──
    const { loadAICoreConfig } = await import('../config/aicore-config.js');
    loadAICoreConfig(AICORE_DIR);
    // ── Init hooks from AICore settings.json (Phase 2) ──
    initHooksFromAICore(AICORE_DIR);
    // ── MCP Bridge wiring (Phase 7.0 / P0 fix) ──
    // Load MCP server configs and register their tools into the pool.
    // MCP tools get `mcp__<server>__<tool>` names to avoid collisions.
    await loadAndRegisterMCPTools(AICORE_DIR);
    // ── CLI flag overrides (P3.2: parseFlags replaces env-only approach) ──
    const cliFlags = parseFlags(process.argv);
    // --help / --version shortcuts
    if (cliFlags.help) {
        console.log(renderHelp());
        process.exit(0);
    }
    if (cliFlags.version) {
        console.log(`v${pkg.version}`);
        process.exit(0);
    }
    // Also respect env vars as overrides
    const flagPermissionMode = cliFlags.permissionMode || process.env.CODESQUAD_PERMISSION_MODE;
    const flagDefaultModel = cliFlags.model || process.env.CODESQUAD_DEFAULT_MODEL;
    const flagSandbox = cliFlags.sandbox ?? (process.env.CODESQUAD_SANDBOX === '1');
    const flagMcpConfig = cliFlags.mcpConfig || process.env.CODESQUAD_MCP_CONFIG;
    const flagStream = cliFlags.stream ?? false;
    const settings = loadSettings();
    const state = {
        currentSession: null,
        providerId: null,
        modelId: null,
        modeState: flagPermissionMode
            ? { currentMode: permissionModeToChatModeState(flagPermissionMode), wasPlanBefore: false, modeEnteredAt: Date.now() }
            : createDefaultModeState(),
        hasCraftConfirmed: settings.hasCraftConfirmed,
        streamingEnabled: flagStream || settings.streamingEnabled,
        exiting: false,
    };
    // ── Apply CLI flag: --add-dir / --bare (Feature 6, P4) ──
    const cliAddDirs = cliFlags.addDir?.map((d) => join(PROJECT_ROOT, d)) || [];
    setGlobalGuidanceFlags(cliAddDirs, cliFlags.bare);
    if (cliFlags.bare) {
        console.log(infoLine('Bare mode: CODESQUAD.md 自动发现已跳过。'));
    }
    // ── Apply CLI flag: --model ──
    if (flagDefaultModel) {
        const [provId, ...modelParts] = flagDefaultModel.split('/');
        if (provId && modelParts.length > 0) {
            state.providerId = provId;
            state.modelId = modelParts.join('/');
        }
    }
    // ── Apply CLI flag: --sandbox ──
    if (flagSandbox) {
        loadSandboxConfig({ enabled: true, autoAllowBashIfSandboxed: true, excludedCommands: ['git', 'docker', 'rm', 'curl'] });
    }
    // ── Apply CLI flag: --mcp-config (extra MCP config path) ──
    if (flagMcpConfig) {
        try {
            const mcpPath = join(PROJECT_ROOT, flagMcpConfig);
            if (existsSync(mcpPath)) {
                await loadAndRegisterMCPToolsFromPath(mcpPath);
            }
        }
        catch { /* non-critical */ }
    }
    const editor = createEditor();
    // ── Auto-detect provider ──
    await detectAndSetProvider(state);
    // ── Load agents from all three layers (Phase 6) ──
    loadAllAgentsLayered(AICORE_DIR);
    // ── Run SessionStart hooks (Phase 2) ──
    const hookResult = await executeSessionStartHooks('startup');
    if (hookResult.stdout) {
        console.log(chalk.dim(hookResult.stdout));
    }
    // ── readline setup ──
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        prompt: buildPrompt(state, editor),
    });
    // Enable keypress event emission for Alt+Enter / Ctrl+G detection.
    // Without this, process.stdin.on('keypress', ...) never fires (D1).
    emitKeypressEvents(process.stdin, rl);
    let ctrlCCount = 0;
    let ctrlCTimer = null;
    let altEnterFallbackShown = false;
    function resetCtrlC() {
        ctrlCCount = 0;
        if (ctrlCTimer) {
            clearTimeout(ctrlCTimer);
            ctrlCTimer = null;
        }
    }
    // ── Prompt builder ──
    function buildPrompt(st, ed) {
        if (isInEditMode(ed))
            return editPrompt();
        const modeBadge = renderModeBadge(st.modeState.currentMode);
        const prefix = st.currentSession
            ? chalk.green(`[${st.currentSession.agent}]`)
            : chalk.cyan('CodeSquad');
        if (modeBadge)
            return `${prefix} ${modeBadge} ${chalk.dim('> ')}`;
        return `${prefix} ${chalk.dim('> ')}`;
    }
    function updatePrompt() {
        rl.setPrompt(buildPrompt(state, editor));
    }
    // ── Mode switch helper ──
    /**
     * Switch to a new mode, updating state, showing UI feedback,
     * injecting a system transition message to the current session,
     * and persisting the mode to disk.
     */
    async function switchMode(newMode, fromUser) {
        const from = state.modeState.currentMode;
        if (from === newMode)
            return;
        // v4 P2: wasPlanBefore simplifies to a boolean
        state.modeState = {
            currentMode: newMode,
            wasPlanBefore: from === 'plan' && newMode !== 'plan',
            modeEnteredAt: Date.now(),
        };
        // No console.log here — the caller is responsible for displaying feedback
        // (avoids double-printing when called from /mode dispatch)
        // Inject system message to current session (filtered by sendToAgent, won't reach LLM)
        if (state.currentSession) {
            const transitionMsg = getModeTransitionMessage(state.modeState.wasPlanBefore, newMode);
            if (transitionMsg) {
                addMessage(state.currentSession, 'system', transitionMsg);
            }
            await persistModeToSession(state.currentSession, newMode);
        }
        updatePrompt();
    }
    // ── Provider detection ──
    async function detectAndSetProvider(st) {
        // Try to resolve from env
        const providers = listProviders();
        for (const p of providers) {
            const key = await resolveApiKey(p.id);
            if (key) {
                st.providerId = p.id;
                st.modelId = p.defaultModel;
                return;
            }
        }
        // Check Ollama
        if (await detectOllama()) {
            await registerOllamaProvider();
            st.providerId = 'ollama';
            st.modelId = 'llama3.1';
        }
    }
    // ── Get runtime config ──
    async function getRuntimeConfig() {
        const modelConfig = state.currentSession?.modelConfig ?? DEFAULT_MODEL_CONFIG;
        const providerId = state.providerId ?? modelConfig.provider;
        const runtimeConfig = await buildRuntimeConfig(providerId);
        if (!runtimeConfig)
            return null;
        return {
            provider: runtimeConfig.protocol,
            apiKey: runtimeConfig.apiKey,
            model: modelConfig.model,
        };
    }
    // ── Command dispatcher ──
    async function handleCommand(cmd) {
        switch (cmd.type) {
            case 'empty': break;
            case 'agent':
                await handleAgentCommand(cmd);
                break;
            case 'skill':
                await handleSkillCommand(cmd);
                break;
            case 'builtin':
                await handleBuiltinCommand(cmd);
                break;
            case 'text':
                await handleTextInput(cmd);
                break;
        }
    }
    // ── Agent command ──
    async function handleAgentCommand(cmd) {
        if (!agentExists(cmd.name)) {
            console.log(errorLine(`未找到 agent: ${chalk.bold(cmd.name)}。输入 /agents 查看可用列表`));
            return;
        }
        if (cmd.input.length > 0) {
            // Start or continue agent conversation
            await startOrContinueAgent(cmd.name, cmd.input);
        }
        else {
            // Enter edit mode
            enterEditMode(editor, `@${cmd.name}`);
            if (!altEnterFallbackShown) {
                console.log(getSubmitFallbackHint());
                altEnterFallbackShown = true;
            }
        }
        updatePrompt();
    }
    async function startOrContinueAgent(agentName, userInput) {
        // Switching to a different agent: persist the current session first
        // (otherwise the old conversation is silently lost — see design §3.3)
        const isNewSession = !state.currentSession || state.currentSession.agent !== agentName;
        if (state.currentSession && state.currentSession.agent !== agentName) {
            if (state.currentSession.messages.length > 0) {
                try {
                    await save(state.currentSession);
                }
                catch {
                    console.log(warnLine(`旧会话 ${state.currentSession.id.slice(0, 8)} 保存失败`));
                }
            }
            // New agent → resolve model from models.config.yaml + frontmatter + batch mapping
            state.currentSession = createSession(agentName, resolveAgentModel(agentName));
        }
        else if (!state.currentSession) {
            state.currentSession = createSession(agentName, resolveAgentModel(agentName));
        }
        // v3: Restore mode from session (decision D4)
        state.modeState = {
            currentMode: restoreModeFromSession(state.currentSession),
            wasPlanBefore: false,
            modeEnteredAt: Date.now(),
        };
        // v4: Inject cross-chat memory for new sessions
        if (isNewSession && state.currentSession) {
            try {
                const limit = getMemoryLimit();
                const summary = await summarizeHistory(limit, state.currentSession.id);
                if (summary) {
                    const formatted = formatHistorySummary(summary);
                    state.currentSession.context.injectedContent = formatted + '\n\n' + (state.currentSession.context.injectedContent ?? '');
                }
            }
            catch {
                // Silently skip cross-chat memory on error
            }
        }
        await sendToAgent(agentName, userInput);
    }
    // ── Skill command ──
    async function handleSkillCommand(cmd) {
        const skill = loadSkill(cmd.name);
        if (!skill) {
            console.log(errorLine(`未找到 skill: ${chalk.bold(cmd.name)}。输入 /skills 查看可用列表`));
            return;
        }
        // Enforce user-invocable check (Claude Code alignment)
        if (!skill.userInvocable) {
            console.log(errorLine(`Skill ${chalk.bold(cmd.name)} 不可直接调用。`));
            return;
        }
        // Show argument hint
        if (skill.argumentHint) {
            console.log(infoLine(`${chalk.bold(cmd.name)} ${chalk.dim(skill.argumentHint)}`));
        }
        else {
            console.log(infoLine(`正在执行 skill: ${chalk.bold(cmd.name)}...`));
        }
        // v6 (Claude Code alignment): route through agent if skill specifies one
        if (skill.agent && agentExists(skill.agent)) {
            console.log(infoLine(`→ 路由到 Agent: ${chalk.green(`@${skill.agent}`)}`));
            // Set skill's model on the session if specified
            if (skill.model && state.currentSession) {
                state.currentSession.modelConfig.model = skill.model;
            }
            // Forward to agent with skill context
            await startOrContinueAgent(skill.agent, `/${cmd.name} ${cmd.args || ''}`);
            return;
        }
        // Use skill's model override if specified, else default
        const model = skill.model ?? state.modelId ?? DEFAULT_MODEL_CONFIG.model;
        startSpinner(`${cmd.name} 执行中...`);
        try {
            const runtimeConfig = await buildRuntimeConfig(state.providerId);
            if (!runtimeConfig) {
                stopSpinner();
                console.log(errorLine('未配置 Provider — 使用 /model 设置或设置环境变量'));
                return;
            }
            // Build SkillInstance — encapsulates the tool-use loop with pause/resume support
            let displayedFirstContent = false;
            let finalInstanceContent = '';
            const instance = new SkillInstance({
                skill,
                skillArgs: cmd.args || '',
                model,
                providerId: state.providerId,
                runtimeConfig,
                projectRoot: PROJECT_ROOT,
                cwd: process.cwd(),
                mode: state.modeState.currentMode,
                lang: 'zh',
                onStep(event) {
                    switch (event.type) {
                        case 'text': {
                            // First text after spinner: stop spinner and display content
                            if (!displayedFirstContent && event.text) {
                                stopSpinner();
                                console.log(separator());
                                console.log(renderFormattedContent(event.text));
                                displayedFirstContent = true;
                            }
                            break;
                        }
                        case 'tool_call': {
                            startSpinner(`  ${event.toolName} 执行中...`);
                            break;
                        }
                        case 'tool_result': {
                            stopSpinner();
                            if (event.toolIsError) {
                                console.log(warnLine(`  ${event.toolName}: ${event.toolResult}`));
                            }
                            else {
                                console.log(chalk.dim(`  ${event.toolName}: ✓`));
                            }
                            break;
                        }
                        case 'question': {
                            // Skill needs user input — store in state and pause
                            if (event.question) {
                                state.__pendingQuestions = event.question;
                                state.__pendingSkillResume = {
                                    instanceId: event.instanceId,
                                    skillName: event.skillName,
                                };
                                stopSpinner();
                                void renderAskUserQuestions(event.question);
                            }
                            break;
                        }
                        case 'done': {
                            stopSpinner();
                            finalInstanceContent = event.finalContent || '';
                            console.log(separator());
                            if (finalInstanceContent) {
                                console.log(renderFormattedContent(finalInstanceContent));
                            }
                            console.log(separator());
                            break;
                        }
                        case 'error': {
                            stopSpinner();
                            if (event.error) {
                                console.log(errorLine(event.error.message));
                            }
                            break;
                        }
                    }
                },
            });
            // Register and execute the instance
            // Execute blocks on await until done or paused for user input.
            // If paused (question event), control returns here, and the REPL
            // line handler will pick up __pendingSkillResume on next input.
            await instance.execute();
            // If we get here and there's no pending question, the skill completed
            if (instance.status === 'awaiting_user') {
                // The REPL line handler will resume this instance on next user input
                // (checked via state.__pendingSkillResume)
                return;
            }
            // Skill completed (or failed) — save result to session and record usage
            if (state.currentSession && finalInstanceContent) {
                addMessage(state.currentSession, 'user', `/${cmd.name} ${cmd.args || ''}`);
                addMessage(state.currentSession, 'assistant', finalInstanceContent);
            }
            if (instance.totalPromptTokens > 0 || instance.totalCompletionTokens > 0) {
                console.log(renderTokenUsage(instance.totalPromptTokens, instance.totalCompletionTokens, 0, instance.totalCost));
                await recordUsage({
                    timestamp: new Date().toISOString(),
                    agent: `skill:${cmd.name}#${instance.id.slice(0, 8)}`,
                    provider: state.providerId,
                    model,
                    promptTokens: instance.totalPromptTokens,
                    completionTokens: instance.totalCompletionTokens,
                    cost: instance.totalCost,
                });
            }
        }
        catch (err) {
            stopSpinner();
            if (err instanceof LlmError && (err.status === 0 || err.status >= 500)) {
                if (await tryOllamaFallback()) {
                    return handleSkillCommand(cmd);
                }
            }
            if (err instanceof LlmError) {
                console.log(errorLine(err.message));
            }
            else {
                console.log(errorLine(`Skill 执行失败: ${err.message}`));
            }
        }
    }
    // ── Builtin commands ──
    async function handleBuiltinCommand(cmd) {
        switch (cmd.name) {
            case 'help':
                console.log(renderHelp());
                break;
            case 'quit':
            case 'exit':
                await saveAndExit();
                return;
            case 'new':
                state.currentSession = null;
                cancelEdit(editor);
                clearSessionCache();
                resetHookState();
                clearPromptCache();
                invalidateProjectGuidance();
                console.log(okLine('已开始新会话'));
                break;
            case 'agents':
                await listAgents(cmd.args);
                break;
            case 'skills':
                await listSkills(cmd.args);
                break;
            case 'agent':
                await showAgentInfo(cmd.args);
                break;
            case 'skill':
                await showSkillInfo(cmd.args);
                break;
            case 'tools':
                await handleTools();
                break;
            case 'compact':
                await handleManualCompact();
                break;
            // ── Task commands (Feature 2, P4) ──
            case 'tasks':
                await handleTasks(cmd.args);
                break;
            // ── Team commands (Feature 3, P4) ──
            case 'team':
                await handleTeam(cmd.args);
                break;
            // ── Session commands ──
            case 'sessions':
                await handleSessions();
                break;
            case 'resume':
                await handleResume(cmd.args);
                break;
            case 'export':
                await handleExport(cmd.args);
                break;
            case 'rename':
                await handleRename(cmd.args);
                break;
            case 'delete':
            case 'del':
                handleDeleteMessage(cmd.args);
                break;
            // ── Context commands ──
            case 'ctx':
            case 'context':
                await handleContext(cmd.args);
                break;
            // ── Model commands ──
            case 'model':
                await handleModel(cmd.args);
                break;
            case 'provider':
                await handleProvider(cmd.args);
                break;
            // ── Usage commands ──
            case 'usage':
                await handleUsage(cmd.args);
                break;
            // ── Mode commands ──
            case 'mode': {
                const result = handleModeCommand(cmd.args, state.modeState, state.hasCraftConfirmed);
                if (result.status === 'invalid' || result.status === 'unchanged') {
                    console.log(result.message);
                }
                else if (result.status === 'confirm-required') {
                    console.log(result.message);
                    const confirmed = await confirmCraftMode(rl);
                    if (confirmed) {
                        state.hasCraftConfirmed = true;
                        saveSettings({ hasCraftConfirmed: true }); // v5: persist across sessions
                        if (result.newMode)
                            await switchMode(result.newMode, 'cmd');
                    }
                    else {
                        console.log(infoLine('已取消，保持在当前模式'));
                    }
                }
                else if (result.status === 'ok' && result.newMode) {
                    console.log(result.message);
                    await switchMode(result.newMode, 'cmd');
                }
                break;
            }
            // ── Streaming toggle (Phase P3.1) ──
            case 'stream': {
                const arg = cmd.args.trim().toLowerCase();
                if (!arg) {
                    console.log(infoLine(`Streaming: ${state.streamingEnabled ? 'ON' : 'OFF'}`));
                }
                else if (arg === 'on' || arg === 'true') {
                    state.streamingEnabled = true;
                    console.log(okLine('Streaming enabled — Agent will output token-by-token'));
                    saveSettings({ streamingEnabled: true });
                }
                else if (arg === 'off' || arg === 'false') {
                    state.streamingEnabled = false;
                    console.log(okLine('Streaming disabled — Agent returns full response at once'));
                    saveSettings({ streamingEnabled: false });
                }
                else {
                    console.log(warnLine('Usage: /stream [on|off]'));
                }
                break;
            }
            // ── Memory limit command ──
            case 'memory-limit': {
                const arg = cmd.args.trim();
                if (!arg) {
                    const current = getMemoryLimit();
                    console.log(infoLine(`跨 Chat 记忆追溯数: ${current}`));
                }
                else {
                    const n = parseInt(arg, 10);
                    if (isNaN(n) || n < 2 || n > 15) {
                        console.log(errorLine('请输入 2-15 之间的数字'));
                    }
                    else {
                        saveSettings({ memoryLimitChats: n });
                        console.log(okLine(`跨 Chat 记忆追溯数已设为 ${n}`));
                    }
                }
                break;
            }
            // ── Reset project files ──
            case 'reset': {
                console.log(infoLine('正在重置项目文件...'));
                const count = installProjectFiles(PROJECT_ROOT, true);
                if (count > 0) {
                    console.log(okLine(`已重置 ${count} 个项目文件`));
                }
                else {
                    console.log(warnLine('没有文件被重置（配置文件可能不存在或为空）'));
                }
                break;
            }
            default:
                console.log(errorLine(`未知命令: /${cmd.name}。输入 /help 查看可用命令`));
        }
        updatePrompt();
    }
    // ── Text input (forward to agent) ──
    async function handleTextInput(cmd) {
        if (state.currentSession) {
            await sendToAgent(state.currentSession.agent, cmd.content);
        }
        else {
            console.log(infoLine('请先使用 @agent-name 选择一个 Agent 开始对话'));
            console.log(infoLine(`输入 ${chalk.bold('/agents')} 查看可用 Agent`));
        }
    }
    // ── AskUserQuestion rendering (Feature 1, P5) ──
    async function renderAskUserQuestions(pending) {
        console.log(separator());
        console.log(chalk.bold.cyan('💬 Agent 需要更多信息:'));
        console.log(chalk.dim('─'.repeat(60)));
        for (let i = 0; i < pending.questions.length; i++) {
            const q = pending.questions[i];
            console.log(`\n${chalk.bold(`${i + 1}. ${q.header}`)}`);
            console.log(chalk.white(`   ${q.question}`));
            for (const opt of q.options) {
                const key = `${i + 1}${String.fromCharCode(97 + q.options.indexOf(opt))}`;
                console.log(chalk.green(`   [${key}]`) + ` ${opt.label} — ${chalk.dim(opt.description)}`);
            }
        }
        console.log(chalk.dim('\n' + '─'.repeat(60)));
        console.log(infoLine('请选择答案（多选用逗号分隔），或输入 /cancel 取消:'));
        console.log(chalk.dim(`  例: 1a 选择第一个问题第一项，1a,2b 选多项`));
        console.log();
    }
    // Handle user answer to AskUserQuestion (Feature 1, P5)
    async function handleAskUserAnswer(input) {
        const pending = state.__pendingQuestions;
        const answers = {};
        // Parse format: "1a" or "1a,2b,3c"
        const parts = input.split(/\s*,\s*/);
        for (const part of parts) {
            const match = part.match(/^(\d+)([a-z]+)/i);
            if (match) {
                const qIdx = parseInt(match[1]) - 1;
                if (qIdx >= 0 && qIdx < pending.questions.length) {
                    const q = pending.questions[qIdx];
                    const selectedLabels = [];
                    for (const ch of match[2]) {
                        const optIdx = ch.toLowerCase().charCodeAt(0) - 97;
                        if (optIdx >= 0 && optIdx < q.options.length) {
                            selectedLabels.push(q.options[optIdx].label);
                        }
                    }
                    if (selectedLabels.length > 0) {
                        answers[q.header] = selectedLabels.join(', ');
                    }
                }
            }
        }
        if (Object.keys(answers).length === 0) {
            console.log(warnLine('无法解析答案。格式: 1a 或 1a,2b（数字=问题序号，字母=选项）'));
            return;
        }
        state.__pendingQuestions = undefined;
        // Re-invoke agent with answers
        const answerPrompt = `[AskUserQuestion Answers]\n` +
            Object.entries(answers).map(([k, v]) => `- ${k}: ${v}`).join('\n');
        await sendToAgent(state.currentSession.agent, answerPrompt);
    }
    // ── Core: send to agent via LLM (delegates to shared runAgent — S11 unified) ──
    async function sendToAgent(agentName, userInput) {
        const session = state.currentSession;
        const agentPrompt = loadAgentPrompt(agentName);
        if (!agentPrompt) {
            console.log(errorLine(`无法加载 agent prompt: ${agentName}`));
            return;
        }
        // Resolve runtime config
        const rt = await getRuntimeConfig();
        if (!rt) {
            console.log(errorLine('未配置 Provider — 使用 /model 设置、设置环境变量、或在 models.config.yaml 中配置 apiKey'));
            return;
        }
        const runtimeConfig = await buildRuntimeConfig(state.providerId);
        if (!runtimeConfig) {
            console.log(errorLine('无法获取 API Key — 请设置环境变量或使用 OS Keyring'));
            return;
        }
        // Plan mode notification — inject before runAgent picks up injectedContent
        if (state.modeState.wasPlanBefore) {
            state.modeState.wasPlanBefore = false;
            session.context.injectedContent = (session.context.injectedContent || '') +
                '\n[plan_mode_exit] 用户已退出 Plan 模式，批准了设计方案。你现在可以输出具体的代码实现和修改建议。';
        }
        startSpinner(`${agentName} 正在处理...`);
        // ── S11: delegate to shared runAgent (has all S01-S10 defensive fixes) ──
        const { runAgent } = await import('../chat/agent-runner.js');
        const result = await runAgent({
            agentName,
            userInput,
            session,
            providerId: state.providerId,
            modelId: rt.model,
            projectRoot: PROJECT_ROOT,
            aicoreDir: AICORE_DIR,
            mode: state.modeState.currentMode,
            stream: state.streamingEnabled,
            lang: 'zh',
            runtimeConfig,
            onToken: (text) => {
                if (state.modeState.currentMode === 'plan')
                    return;
                process.stdout.write(chalk.white(text));
            },
            onThinking: (text) => {
                if (state.modeState.currentMode === 'plan')
                    return;
                // thinking stream handled by callLLMStream internally
            },
            onTurn: (turn, response, toolCalls) => {
                stopSpinner();
                if (toolCalls && toolCalls.length > 0) {
                    console.log(separator());
                    console.log(renderFormattedContent(response));
                    console.log(chalk.dim(`  → 执行 ${toolCalls.length} 个工具调用...`));
                }
            },
            onToolUse: (toolName, input, result) => {
                stopSpinner();
                if (result.isError) {
                    console.log(warnLine(`  ${toolName}: ${result.content}`));
                }
                else {
                    console.log(chalk.dim(`  ${toolName}: ✓`));
                }
            },
            onError: (msg) => {
                stopSpinner();
                console.log(errorLine(msg));
            },
        });
        stopSpinner();
        // ── Handle AskUserQuestion ──
        if (result.needsUserInput) {
            state.__pendingQuestions = result.needsUserInput;
            await renderAskUserQuestions(result.needsUserInput);
            return;
        }
        // ── Handle permission approval ──
        if (result.needsApproval) {
            // ... REPL-specific approval flow
        }
        // ── Render final response ──
        if (result.finalResponse && result.toolCallsMade > 0) {
            console.log(separator());
            console.log(renderFormattedContent(result.finalResponse));
            console.log(separator());
        }
        // ── Token usage ──
        if (result.turnsUsed > 0) {
            const budget = computeBudget(rt.model, agentPrompt);
            console.log(chalk.dim(`  ${result.turnsUsed} turns, ${result.toolCallsMade} tool calls`));
        }
        if (result.error) {
            console.log(errorLine(result.error));
        }
        // Session saved by runAgent internally (S02 final save)
    }
    // S11: old loop removed
    /**
     * Extract tool calls from LLM response content.
     * Parses structured XML: <tool-call name="ToolName">{"key":"value"}</tool-call>
     * Also supports Claude-style: <function_calls>...</function_calls>
     */
    function extractToolCalls(content) {
        const results = [];
        // Pattern 1a: <tool-call name="ToolName">{"key":"value"}</tool-call>
        const toolPattern = /<tool-call\s+name="([^"]+)"\s*>([\s\S]*?)<\/tool-call>/gi;
        let match;
        while ((match = toolPattern.exec(content)) !== null) {
            try {
                const name = match[1];
                const jsonStr = match[2].trim();
                const input = jsonStr ? JSON.parse(jsonStr) : {};
                results.push({ name, input });
            }
            catch (err) {
                results.push({
                    name: match[1],
                    input: { _error: `Malformed JSON: ${err.message}`, _raw: match[2].trim().slice(0, 200) },
                });
            }
        }
        // Pattern 1b: <tool-call name="ToolName" /> (self-closing, no body)
        const selfClosingPattern = /<tool-call\s+name="([^"]+)"\s*\/>/gi;
        while ((match = selfClosingPattern.exec(content)) !== null) {
            results.push({ name: match[1], input: {} });
        }
        // Pattern 2: JSON block with tool_calls array (Claude/OpenAI style)
        const jsonBlock = content.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);
        if (jsonBlock && results.length === 0) {
            try {
                const parsed = JSON.parse(jsonBlock[0]);
                if (Array.isArray(parsed.tool_calls)) {
                    for (const tc of parsed.tool_calls) {
                        const name = tc.function?.name || tc.name;
                        const input = tc.function?.arguments
                            ? (typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments)
                            : (tc.input || {});
                        if (name)
                            results.push({ name, input: input || {} });
                    }
                }
            }
            catch { /* skip */ }
        }
        // Filter to only existing tools
        return results.filter((tc) => findTool(tc.name) !== undefined);
    }
    /** Shared extractToolCalls (used by agent runner too). */
    function extractToolCallsForAgent(content, agentToolNames) {
        return extractToolCalls(content).filter((tc) => agentToolNames.has(tc.name));
    }
    /**
     * Switch the active provider to local Ollama if available.
     * Returns true on successful switch. Bounded by retry count to prevent
     * infinite recursion if Ollama also fails.
     */
    async function tryOllamaFallback() {
        if (state.providerId === 'ollama')
            return false; // already on Ollama
        if (await detectOllama()) {
            await registerOllamaProvider();
            state.providerId = 'ollama';
            state.modelId = 'llama3.1';
            console.log(warnLine('网络不可用，切换到本地 Ollama...'));
            return true;
        }
        return false;
    }
    // ── Save and exit ──
    async function saveAndExit() {
        if (state.currentSession) {
            try {
                await save(state.currentSession);
                console.log(okLine(`会话已保存: ${state.currentSession.name} (${state.currentSession.id.slice(0, 8)})`));
            }
            catch {
                console.log(warnLine('会话保存失败'));
            }
        }
        // Run Stop hooks (Phase 2)
        try {
            await executeStopHooks();
        }
        catch { /* non-critical */ }
        // Feature 6 (P5): Shut down LSP client
        try {
            const { stopLspClient } = await import('../services/lsp-client.js');
            await stopLspClient();
        }
        catch { /* non-critical */ }
        state.exiting = true;
        rl.close();
    }
    // ── /sessions ──
    async function handleSessions() {
        const sessions = await listSessions();
        if (sessions.length === 0) {
            console.log(infoLine('没有历史会话'));
            return;
        }
        console.log(chalk.bold('\n  历史会话:'));
        console.log(chalk.dim('  ' + '─'.repeat(72)));
        for (const s of sessions.slice(0, 20)) {
            const date = s.updatedAt.slice(0, 10);
            const msgCount = `${s.messageCount} 条消息`;
            console.log(`  ${chalk.green(s.idShort)}  ${chalk.bold(s.agent)}  ${s.name.slice(0, 30)}  ${chalk.dim(date)}  ${chalk.dim(msgCount)}`);
        }
        if (sessions.length > 20) {
            console.log(chalk.dim(`  ... 还有 ${sessions.length - 20} 个会话`));
        }
        console.log();
    }
    // ── /resume <id> ──
    async function handleResume(id) {
        if (!id) {
            console.log(warnLine('用法: /resume <会话ID前8位>'));
            return;
        }
        let session = await load(id);
        if (!session) {
            session = await findSessionById(id);
        }
        if (!session) {
            console.log(errorLine(`未找到会话: ${id}`));
            return;
        }
        state.currentSession = session;
        // Restore mode from resumed session
        state.modeState = {
            currentMode: restoreModeFromSession(session),
            wasPlanBefore: false,
            modeEnteredAt: Date.now(),
        };
        console.log(okLine(`已恢复会话: ${session.name} (${session.messages.length} 条消息)`));
        console.log(infoLine(`Agent: ${chalk.bold(session.agent)} | Model: ${session.modelConfig.model}`));
        console.log();
    }
    // ── /export [id] ──
    async function handleExport(id) {
        const session = id ? (await load(id) ?? await findSessionById(id)) : state.currentSession;
        if (!session) {
            console.log(errorLine('没有可导出的会话。使用 /export <id> 指定会话'));
            return;
        }
        const exportPath = await exportSession(session, {
            redactSystem: true,
            redactApiKeys: true,
            redactPaths: false,
        });
        console.log(okLine(`已导出到: ${exportPath}`));
    }
    // ── /rename <name> ──
    async function handleRename(name) {
        if (!state.currentSession) {
            console.log(warnLine('没有活跃会话'));
            return;
        }
        if (!name) {
            console.log(warnLine('用法: /rename <新名称>'));
            return;
        }
        state.currentSession.name = name;
        await save(state.currentSession);
        console.log(okLine(`已重命名为: ${name}`));
    }
    // ── /delete [n] / /del [n] ──
    function handleDeleteMessage(args) {
        if (!state.currentSession) {
            console.log(warnLine('没有活跃会话'));
            return;
        }
        const session = state.currentSession;
        const n = parseInt(args, 10);
        if (!args || isNaN(n)) {
            // Show recent messages with indices
            const recent = getRecentMessages(session, 10);
            console.log(separator());
            for (let i = 0; i < recent.length; i++) {
                const idx = session.messages.length - recent.length + i + 1;
                const msg = recent[i];
                const prefix = msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : '⚙️';
                const preview = msg.content.replace(/\n/g, ' ').slice(0, 80);
                console.log(chalk.dim(`  ${String(idx).padStart(3, ' ')}  ${prefix} ${preview}`));
            }
            console.log(separator());
            console.log(infoLine('用法: /delete <序号>  例如 /delete 5'));
            return;
        }
        const removed = deleteMessage(session, n);
        if (!removed) {
            console.log(warnLine(`序号 ${n} 无效 — 共 ${session.messages.length} 条消息`));
            return;
        }
        const preview = removed.content.replace(/\n/g, ' ').slice(0, 60);
        console.log(okLine(`已删除消息 #${n}: ${preview}...`));
        save(session).catch(() => { });
    }
    // ── /ctx ──
    async function handleContext(args) {
        if (!state.currentSession) {
            console.log(warnLine('请先使用 @agent-name 开始对话'));
            return;
        }
        const parts = args.split(/\s+/);
        const subCmd = parts[0];
        const target = parts.slice(1).join(' ');
        switch (subCmd) {
            case 'add': {
                if (!target) {
                    console.log(warnLine('用法: /ctx add <文件路径>'));
                    return;
                }
                const filePath = join(process.cwd(), target);
                try {
                    const content = readFileSync(filePath, 'utf-8');
                    state.currentSession.context.injectedFiles.push(filePath);
                    state.currentSession.context.injectedContent += `\n\n### ${target}\n${content.slice(0, 20000)}`;
                    console.log(okLine(`已注入: ${target} (${content.length} 字符)`));
                }
                catch {
                    console.log(errorLine(`无法读取文件: ${target}`));
                }
                break;
            }
            case 'list': {
                if (state.currentSession.context.injectedFiles.length === 0) {
                    console.log(infoLine('没有注入的上下文文件'));
                }
                else {
                    console.log(chalk.bold('\n  已注入文件:'));
                    for (const f of state.currentSession.context.injectedFiles) {
                        console.log(`  ${chalk.dim('→')} ${f}`);
                    }
                    console.log();
                }
                break;
            }
            case 'remove': {
                if (!target) {
                    console.log(warnLine('用法: /ctx remove <文件路径>'));
                    return;
                }
                const idx = state.currentSession.context.injectedFiles.indexOf(join(process.cwd(), target));
                if (idx >= 0) {
                    state.currentSession.context.injectedFiles.splice(idx, 1);
                    console.log(okLine(`已移除: ${target}`));
                }
                else {
                    console.log(errorLine(`未找到: ${target}`));
                }
                break;
            }
            case 'clear':
                state.currentSession.context.injectedFiles = [];
                state.currentSession.context.injectedContent = '';
                console.log(okLine('已清除所有注入上下文'));
                break;
            case 'tokens':
            case '': {
                const messages = state.currentSession.messages;
                const model = state.currentSession.modelConfig.model;
                const tokenCount = estimateTokenCount(messages, model);
                const agentPrompt = state.currentSession.agent ? loadAgentPrompt(state.currentSession.agent) ?? '' : '';
                const budget = computeBudget(model, agentPrompt);
                console.log(chalk.bold('\n  Token 用量详情:'));
                console.log(`    System prompt:  ${chalk.yellow(formatNum(budget.systemPromptTokens))}`);
                console.log(`    注入上下文:     ${chalk.yellow(formatNum(tokenCount.context))} (${state.currentSession.context.injectedFiles.length} files)`);
                console.log(`    对话历史:       ${chalk.yellow(formatNum(tokenCount.history))} (${state.currentSession.messages.length} 轮)`);
                console.log(`    预留输出:       ${chalk.yellow(formatNum(budget.outputReserve))}`);
                console.log(chalk.dim('    ' + '─'.repeat(28)));
                const used = budget.systemPromptTokens + tokenCount.context + tokenCount.history + budget.outputReserve;
                const freeTokens = budget.availableForContext - tokenCount.context - tokenCount.history;
                const freePct = ((freeTokens / budget.modelMaxTokens) * 100).toFixed(1);
                console.log(`    已用:           ${chalk.yellow(formatNum(used))}`);
                console.log(`    可用:           ${chalk.green(formatNum(freeTokens))} (${freePct}%)`);
                console.log();
                break;
            }
            default:
                console.log(warnLine(`未知 ctx 子命令: ${subCmd}`));
                console.log(infoLine('可用: /ctx add <文件> | /ctx list | /ctx remove <文件> | /ctx clear | /ctx tokens'));
        }
    }
    function formatNum(n) {
        if (n >= 1000)
            return `${(n / 1000).toFixed(1)}K`;
        return String(n);
    }
    // ── /model ──
    async function handleModel(args) {
        if (!args) {
            // Show current
            if (state.currentSession) {
                console.log(infoLine(`当前: ${state.currentSession.modelConfig.provider}/${state.currentSession.modelConfig.model}`));
            }
            console.log(chalk.bold('\n  可用模型:'));
            for (const p of listProviders()) {
                console.log(`  ${chalk.green(p.id)}:`);
                for (const m of p.models) {
                    const marker = (state.providerId === p.id && state.modelId === m) ? chalk.yellow(' ★') : '';
                    console.log(`    - ${m}${marker}`);
                }
            }
            console.log();
            console.log(infoLine('用法: /model <provider/model>  例如: /model deepseek/deepseek-chat'));
            return;
        }
        const [providerId, ...modelParts] = args.split('/');
        const modelId = modelParts.join('/');
        if (!providerId || !modelId) {
            console.log(warnLine('用法: /model <provider/model>  例如: /model anthropic/claude-sonnet-4-20250514'));
            return;
        }
        const provider = getProvider(providerId);
        if (!provider) {
            console.log(errorLine(`未知 Provider: ${providerId}`));
            return;
        }
        if (!provider.models.includes(modelId)) {
            console.log(errorLine(`模型 ${modelId} 不在 Provider ${providerId} 的列表中`));
            console.log(infoLine(`可用模型: ${provider.models.join(', ')}`));
            return;
        }
        // Check API key
        const key = await resolveApiKey(providerId);
        if (!key) {
            console.log(errorLine(`未设置 ${provider.envVar} 环境变量或 OS Keyring`));
            console.log(infoLine(`请设置: export ${provider.envVar}=your-key`));
            return;
        }
        state.providerId = providerId;
        state.modelId = modelId;
        if (state.currentSession) {
            state.currentSession.modelConfig.provider = providerId;
            state.currentSession.modelConfig.model = modelId;
            await save(state.currentSession);
        }
        console.log(okLine(`已切换: ${provider.name} / ${modelId}`));
    }
    // ── /provider ──
    async function handleProvider(args) {
        if (args === 'keyring-store' || args.startsWith('keyring-store')) {
            const providerId = args.split(/\s+/)[1];
            if (!providerId) {
                console.log(warnLine('用法: /provider keyring-store <provider-id>'));
                return;
            }
            const provider = getProvider(providerId);
            if (!provider) {
                console.log(errorLine(`未知 provider: ${providerId}`));
                return;
            }
            if (!(await isKeyringAvailable())) {
                console.log(errorLine('OS Keyring 不可用。请改用环境变量：'));
                console.log(infoLine(`  export ${provider.envVar}=your-key`));
                return;
            }
            // Suspend main REPL prompt, prompt for key on a separate readline instance
            const promptRl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
            console.log(infoLine(`请输入 ${providerId} 的 API Key (输入不会回显，直接按回车提交):`));
            process.stdout.write('  > ');
            // Mute echo
            const stdin = process.stdin;
            const wasRaw = stdin.isRaw ?? false;
            if (stdin.setRawMode)
                stdin.setRawMode(true);
            let key = '';
            await new Promise((resolve) => {
                const onData = (chunk) => {
                    const s = chunk.toString();
                    for (const ch of s) {
                        const code = ch.charCodeAt(0);
                        if (code === 13 || code === 10) {
                            // Enter — submit
                            promptRl.removeListener('data', onData);
                            promptRl.close();
                            return resolve();
                        }
                        else if (code === 3) {
                            // Ctrl+C — cancel
                            key = '';
                            promptRl.removeListener('data', onData);
                            promptRl.close();
                            return resolve();
                        }
                        else if (code === 8 || code === 127) {
                            // Backspace
                            key = key.slice(0, -1);
                        }
                        else if (code >= 32) {
                            key += ch;
                        }
                        process.stdout.write('*');
                    }
                };
                promptRl.on('data', onData);
            });
            if (stdin.setRawMode)
                stdin.setRawMode(wasRaw);
            process.stdout.write('\n');
            key = key.trim();
            if (!key) {
                console.log(warnLine('已取消（未输入）'));
                return;
            }
            try {
                await storeKey(providerId, key);
                console.log(okLine(`已存储到 OS Keyring: ${providerId}`));
                // Auto-switch active provider if nothing was set
                if (!state.providerId) {
                    state.providerId = providerId;
                    state.modelId = provider.defaultModel;
                    console.log(okLine(`已自动切换到 ${provider.name} / ${provider.defaultModel}`));
                }
            }
            catch (e) {
                console.log(errorLine(`存储失败: ${e.message}`));
            }
            return;
        }
        // List providers with status
        console.log(chalk.bold('\n  Provider 状态:'));
        for (const p of listProviders()) {
            const hasKey = !!(await resolveApiKey(p.id));
            const status = hasKey ? chalk.green('✓ 已配置') : chalk.yellow('✗ 未配置');
            const marker = state.providerId === p.id ? chalk.yellow(' ★ 当前') : '';
            console.log(`  ${chalk.bold(p.name)}  ${status}${marker}`);
            console.log(`    ${chalk.dim('协议:')} ${p.protocol}  ${chalk.dim('模型:')} ${p.models.length}`);
        }
        console.log();
        console.log(infoLine('设置: export <PROVIDER>_API_KEY=your-key 或 /provider keyring-store <id>'));
    }
    // ── /usage ──
    async function handleUsage(args) {
        const subCmd = args.trim();
        // /usage cost — just the total
        if (subCmd === 'cost') {
            const totalCost = await getTotalCost();
            console.log(infoLine(`本月累计费用: $${totalCost.toFixed(2)}`));
            return;
        }
        // /usage cache — prompt caching stats (Feature 8, P4)
        if (subCmd === 'cache') {
            const { getCacheStats } = await import('../llm/usage-tracker.js');
            const stats = await getCacheStats();
            console.log(chalk.bold('\n  💾 Prompt 缓存统计:'));
            console.log(chalk.dim('  ' + '─'.repeat(50)));
            console.log(`  创建缓存 tokens:   ${chalk.yellow(formatNum(stats.totalCacheCreationTokens))}`);
            console.log(`  命中缓存 tokens:   ${chalk.green(formatNum(stats.totalCacheReadTokens))}`);
            console.log(`  预估节省费用:      ${chalk.green(`$${stats.totalSavedCost.toFixed(4)}`)}`);
            if (stats.recordCount > 0) {
                const hitRate = ((stats.totalCacheReadTokens / (stats.totalCacheReadTokens + stats.totalCacheCreationTokens || 1)) * 100).toFixed(1);
                console.log(`  请求含缓存命中:    ${stats.recordCount}`);
                console.log(`  缓存命中率:        ${chalk.green(`${hitRate}%`)}`);
            }
            else {
                console.log(chalk.dim(`  (暂无缓存命中 — 需使用 Anthropic API 自动开启)`));
            }
            console.log();
            return;
        }
        // /usage today — falls back to monthly (per-day API deferred to v1.5)
        if (subCmd === 'today') {
            console.log(infoLine('按日细分暂未实现（v1.5），显示本月数据：'));
        }
        // /usage details — expanded view with provider/model breakdown
        if (subCmd === 'details') {
            const usage = await getMonthlyUsage();
            if (usage.length === 0) {
                console.log(infoLine('本月暂无用量记录'));
                return;
            }
            console.log(chalk.bold('\n  📊 本月用量详情'));
            console.log(chalk.dim('  ' + '─'.repeat(80)));
            console.log(`  ${chalk.dim('Agent/Skill'.padEnd(22))} ${chalk.dim('Provider'.padEnd(12))} ${chalk.dim('Model'.padEnd(28))} ${chalk.dim('请求'.padStart(6))} ${chalk.dim('费用'.padStart(8))}`);
            console.log(chalk.dim('  ' + '─'.repeat(80)));
            for (const u of usage) {
                const agent = u.agent.slice(0, 20);
                const prov = u.provider.slice(0, 10);
                const model = u.model.slice(0, 26);
                const cost = `$${u.cost.toFixed(2)}`.padStart(7);
                console.log(`  ${chalk.green(agent.padEnd(22))} ${prov.padEnd(12)} ${model.padEnd(28)} ${String(u.requests).padStart(6)} ${cost}`);
            }
            console.log();
            return;
        }
        // Default: monthly summary table
        const usage = await getMonthlyUsage();
        const totalCost = await getTotalCost();
        if (usage.length === 0) {
            console.log(infoLine('本月暂无用量记录'));
            return;
        }
        console.log(chalk.bold(`\n  📊 本月用量`));
        console.log(chalk.dim('  ' + '─'.repeat(72)));
        console.log(`  ${chalk.dim('Agent/Skill'.padEnd(24))} ${chalk.dim('请求'.padEnd(8))} ${chalk.dim('输入Token'.padEnd(12))} ${chalk.dim('输出Token'.padEnd(12))} ${chalk.dim('费用')}`);
        console.log(chalk.dim('  ' + '─'.repeat(72)));
        for (const u of usage) {
            const agent = u.agent.slice(0, 22);
            const requests = String(u.requests).padStart(5);
            const inp = formatNum(u.promptTokens).padStart(9);
            const out = formatNum(u.completionTokens).padStart(9);
            const cost = `$${u.cost.toFixed(2)}`.padStart(7);
            console.log(`  ${chalk.green(agent.padEnd(24))} ${requests} ${inp} ${out} ${cost}`);
        }
        console.log(chalk.dim('  ' + '─'.repeat(72)));
        console.log(`  ${chalk.bold('总计'.padEnd(24))} ${chalk.bold(String(usage.reduce((s, u) => s + u.requests, 0)).padStart(5))} ${chalk.bold(formatNum(usage.reduce((s, u) => s + u.promptTokens, 0)).padStart(9))} ${chalk.bold(formatNum(usage.reduce((s, u) => s + u.completionTokens, 0)).padStart(9))} ${chalk.bold(`$${totalCost.toFixed(2)}`.padStart(7))}`);
        console.log();
        // Budget status
        const budget = getBudget();
        if (budget.monthlyBudget > 0) {
            const pct = ((totalCost / budget.monthlyBudget) * 100).toFixed(0);
            console.log(infoLine(`预算: $${totalCost.toFixed(2)} / $${budget.monthlyBudget} (${pct}%)`));
        }
    }
    // ── /tasks ── (Feature 2, P4)
    async function handleTasks(args) {
        const { listTasks, getTask, stopTask } = await import('../tasks/store.js');
        const parts = args.trim().split(/\s+/);
        // /tasks stop <id>
        if (parts[0] === 'stop' && parts[1]) {
            const task = stopTask(parts[1]);
            if (task) {
                console.log(okLine(`Task "${task.name}" (${task.id.slice(0, 8)}) 已停止。`));
            }
            else {
                console.log(errorLine(`未找到 task: ${parts[1]}`));
            }
            return;
        }
        // /tasks <id> — task detail
        if (parts[0] && parts[0] !== 'list') {
            const task = getTask(parts[0]);
            if (!task) {
                const all = listTasks();
                const match = all.find((t) => t.id.startsWith(parts[0]));
                if (!match) {
                    console.log(errorLine(`未找到 task: ${parts[0]}`));
                    return;
                }
                displayTaskDetail(match);
                return;
            }
            displayTaskDetail(task);
            return;
        }
        // /tasks (or /tasks list) — list all
        const all = listTasks();
        if (all.length === 0) {
            console.log(infoLine('无活跃 Task。使用 @agent-name 对话中调用 TaskCreate 工具创建。'));
            return;
        }
        console.log(chalk.bold(`\n  📋 Tasks (${all.length}):`));
        console.log(chalk.dim('  ' + '─'.repeat(60)));
        for (const t of all) {
            const emoji = t.status === 'running' ? '🔄' : t.status === 'completed' ? '✅' : t.status === 'failed' ? '❌' : t.status === 'stopped' ? '🛑' : '⏳';
            const bg = t.runInBackground ? ' [bg]' : '';
            console.log(`  ${emoji} [${t.id.slice(0, 8)}] ${chalk.green(t.name)}${bg} — ${t.status}`);
        }
        console.log();
    }
    function displayTaskDetail(task) {
        console.log(chalk.bold(`\n  📋 Task: ${task.name}`));
        console.log(chalk.dim('  ' + '─'.repeat(50)));
        console.log(`  ID:         ${task.id.slice(0, 8)}`);
        console.log(`  Agent:      @${task.agentType}`);
        console.log(`  Status:     ${task.status}`);
        console.log(`  Background: ${task.runInBackground ? 'yes' : 'no'}`);
        console.log(`  Created:    ${task.createdAt.slice(0, 19)}`);
        if (task.startedAt)
            console.log(`  Started:    ${task.startedAt.slice(0, 19)}`);
        if (task.completedAt)
            console.log(`  Completed:  ${task.completedAt.slice(0, 19)}`);
        if (task.result) {
            console.log(`  Turns:      ${task.result.turns}`);
            console.log(`  Tools:      ${task.result.toolCalls}`);
            console.log(`  Result:     ${task.result.summary.slice(0, 200)}`);
        }
        console.log();
    }
    // ── /team ── (Feature 3, P4)
    async function handleTeam(args) {
        const { listTeams, loadTeam, createTeam, deleteTeam } = await import('../teams/store.js');
        const parts = args.trim().split(/\s+/);
        // /team — list all teams
        if (!parts[0] || parts[0] === 'list') {
            const teams = listTeams();
            if (teams.length === 0) {
                console.log(infoLine('无 Team。使用 TeamCreate 工具创建。'));
                return;
            }
            console.log(chalk.bold(`\n  👥 Teams (${teams.length}):`));
            console.log(chalk.dim('  ' + '─'.repeat(60)));
            for (const t of teams) {
                console.log(`  📁 ${chalk.green(t.name)} — ${t.members.length} 成员 | Lead: ${t.leadAgentId}`);
                if (t.description)
                    console.log(chalk.dim(`     ${t.description}`));
            }
            console.log();
            return;
        }
        // /team create <name> [description]
        if (parts[0] === 'create' && parts[1]) {
            const name = parts[1];
            const desc = parts.slice(2).join(' ');
            if (!/^[a-z][a-z0-9-]*$/.test(name)) {
                console.log(errorLine('Team 名只能包含小写字母、数字和连字符'));
                return;
            }
            const existing = loadTeam(name);
            if (existing) {
                console.log(errorLine(`Team "${name}" 已存在`));
                return;
            }
            const config = createTeam(name, state.currentSession?.agent || 'main', desc);
            console.log(okLine(`Team "${config.name}" 已创建 (Lead: ${config.leadAgentId})`));
            return;
        }
        // /team delete <name>
        if (parts[0] === 'delete' && parts[1]) {
            const { deleteInbox } = await import('../teams/mailbox.js');
            const config = loadTeam(parts[1]);
            if (!config) {
                console.log(errorLine(`Team "${parts[1]}" 不存在`));
                return;
            }
            deleteInbox(parts[1]);
            deleteTeam(parts[1]);
            console.log(okLine(`Team "${parts[1]}" 已删除`));
            return;
        }
        // /team members <name> — list members
        if (parts[0] === 'members' && parts[1]) {
            const config = loadTeam(parts[1]);
            if (!config) {
                console.log(errorLine(`Team "${parts[1]}" 不存在`));
                return;
            }
            console.log(chalk.bold(`\n  👥 Team "${config.name}" — Members:`));
            console.log(chalk.dim('  ' + '─'.repeat(50)));
            for (const m of config.members) {
                const active = m.isActive ? '🟢' : '⚪';
                console.log(`  ${active} ${m.name} (${m.agentId})`);
            }
            console.log();
            return;
        }
        // /team inbox [teamName] — view own inbox
        if (parts[0] === 'inbox') {
            const teamName = parts[1] || 'default';
            const agentName = state.currentSession?.agent || 'main';
            const { readMessages } = await import('../teams/mailbox.js');
            const msgs = readMessages(teamName, agentName);
            if (msgs.length === 0) {
                console.log(infoLine(`收件箱为空 (team: ${teamName}, agent: ${agentName})`));
                return;
            }
            console.log(chalk.bold(`\n  📬 Inbox (${teamName}/${agentName}) — ${msgs.length} 条消息:`));
            console.log(chalk.dim('  ' + '─'.repeat(60)));
            for (const m of msgs) {
                const unread = m.read ? ' ' : '📩';
                console.log(`  ${unread} [${m.from} → ${m.to}] ${m.summary}`);
                console.log(chalk.dim(`     ${m.timestamp.slice(0, 19)} | ${m.type}`));
            }
            console.log();
            return;
        }
        console.log(errorLine('用法: /team [list|create <name>|delete <name>|members <name>|inbox [teamName]]'));
    }
    // ── Agent/Skill listing ──
    async function listAgents(filter) {
        const agentsDir = join(AICORE_DIR, 'agents');
        try {
            const files = virtualReadDir(agentsDir).filter((f) => f.endsWith('.md'));
            const filtered = filter
                ? files.filter((f) => f.toLowerCase().includes(filter.toLowerCase()))
                : files;
            if (filtered.length === 0) {
                console.log(infoLine(filter ? `没有找到匹配 "${filter}" 的 Agent` : '没有可用的 Agent'));
                return;
            }
            console.log(chalk.bold(`\n  可用 Agent (${filtered.length}):`));
            for (const f of filtered.slice(0, 30)) {
                const name = f.replace('.md', '');
                console.log(`  ${chalk.green(`@${name}`)}`);
            }
            if (filtered.length > 30)
                console.log(chalk.dim(`  ... 还有 ${filtered.length - 30} 个`));
            console.log();
        }
        catch {
            console.log(errorLine('无法读取 Agent 目录'));
        }
    }
    async function listSkills(filter) {
        const all = filterUserInvocable(listRegistrySkills());
        const filtered = filter
            ? all.filter((s) => s.dirName.toLowerCase().includes(filter.toLowerCase()))
            : all;
        if (filtered.length === 0) {
            console.log(infoLine(filter ? `没有找到匹配 "${filter}" 的 Skill` : '没有可用的 Skill'));
            return;
        }
        console.log(chalk.bold(`\n  可用 Skill (${filtered.length}):`));
        for (const s of filtered.slice(0, 30)) {
            const desc = s.description ? chalk.dim(` — ${s.description.slice(0, 50)}`) : '';
            console.log(`  ${chalk.yellow(`/${s.dirName}`)}${desc}`);
        }
        if (filtered.length > 0) {
            // Also show non-invocable count
            const hidden = listRegistrySkills().filter((s) => !s.userInvocable);
            if (hidden.length > 0) {
                console.log(chalk.dim(`\n  还有 ${hidden.length} 个内部技能（不可直接调用）`));
            }
        }
        if (filtered.length > 30)
            console.log(chalk.dim(`  ... 还有 ${filtered.length - 30} 个`));
        console.log();
    }
    async function showAgentInfo(name) {
        if (!name) {
            console.log(warnLine('用法: /agent <名称>'));
            return;
        }
        const prompt = loadAgentPrompt(name);
        if (!prompt) {
            console.log(errorLine(`未找到 agent: ${name}`));
            return;
        }
        console.log(separator());
        console.log(chalk.bold(`Agent: ${name}`));
        console.log(separator());
        console.log(prompt.slice(0, 800));
        if (prompt.length > 800)
            console.log(chalk.dim(`\n... (${prompt.length - 800} 更多字符)`));
        console.log(separator());
    }
    async function showSkillInfo(name) {
        if (!name) {
            console.log(warnLine('用法: /skill <名称>'));
            return;
        }
        const skill = loadSkill(name);
        if (!skill) {
            console.log(errorLine(`未找到 skill: ${name}`));
            return;
        }
        console.log(separator());
        console.log(chalk.bold(`Skill: ${skill.name || name}`));
        if (skill.description)
            console.log(chalk.dim(skill.description));
        if (skill.argumentHint)
            console.log(chalk.dim(`参数: ${skill.argumentHint}`));
        if (skill.allowedTools.length > 0)
            console.log(chalk.dim(`工具: ${skill.allowedTools.join(', ')}`));
        if (skill.agent)
            console.log(chalk.dim(`Agent: @${skill.agent}`));
        if (skill.model)
            console.log(chalk.dim(`模型: ${skill.model}`));
        if (!skill.userInvocable)
            console.log(chalk.yellow('⚠ 不可直接调用（user-invocable: false）'));
        console.log(separator());
        console.log(skill.body.slice(0, 800));
        if (skill.body.length > 800)
            console.log(chalk.dim(`\n... (${skill.body.length - 800} 更多字符)`));
        console.log(separator());
    }
    // ── /tools ──
    async function handleTools() {
        const pool = getToolPool();
        const { total, readOnly, destructive } = (await import('../tools/registry.js')).getToolStats();
        console.log(chalk.bold(`\n  可用工具 (${total}):`));
        console.log(chalk.dim(`  ${readOnly} 只读 / ${destructive} 可写`));
        console.log(chalk.dim('  ' + '─'.repeat(60)));
        for (const tool of pool) {
            const ro = tool.isReadOnly() ? chalk.green(' [R]') : chalk.yellow(' [W]');
            const desc = tool.description.slice(0, 60);
            console.log(`  ${chalk.yellow(tool.name)}${ro}  ${chalk.dim(desc)}`);
        }
        console.log();
        console.log(infoLine('Agent 可以通过 <tool-call name="ToolName">{"key":"value"}</tool-call> 调用工具。'));
        console.log(infoLine('权限模式影响工具可用性: Plan 模式下仅允许只读工具。'));
        console.log();
    }
    // ── /compact ──
    async function handleManualCompact() {
        const session = state.currentSession;
        if (!session || session.messages.length < 10) {
            console.log(infoLine('对话消息不足，无需压缩（至少 10 条）。'));
            return;
        }
        console.log(infoLine('正在压缩对话上下文...'));
        startSpinner('压缩中...');
        try {
            const rt = await getRuntimeConfig();
            if (!rt) {
                stopSpinner();
                console.log(errorLine('无法压缩：未配置 Provider'));
                return;
            }
            const model = rt.model;
            const result = await compactConversation(session.messages, session, { model }, async (params) => {
                const runtimeConfig = await buildRuntimeConfig(state.providerId);
                const resp = await callLLM(runtimeConfig, params);
                return resp.content;
            });
            // Apply compaction
            session.messages = applyCompaction(session.messages, result);
            recordCompaction();
            stopSpinner();
            // Show stats
            const stats = calculateContextStats(session.messages, model);
            console.log(formatContextStats(stats));
            console.log(okLine(`压缩完成: ${result.compactedMessageCount} 条消息 → 摘要 (节省 ~${Math.round((1 - result.postCompactTokenCount / result.preCompactTokenCount) * 100)}% token)`));
        }
        catch (err) {
            stopSpinner();
            console.log(errorLine(`压缩失败: ${err.message}`));
        }
    }
    // ── readline event handlers ──
    rl.on('line', async (line) => {
        resetCtrlC();
        if (line.trim() === '#submit' && isInEditMode(editor)) {
            const fullText = getFullText(editor);
            cancelEdit(editor);
            updatePrompt();
            console.log(chalk.dim(`  → ${fullText.slice(0, 80)}${fullText.length > 80 ? '...' : ''}`));
            const cmd = parseInput(fullText);
            await handleCommand(cmd);
            if (state.exiting)
                return;
            rl.prompt();
            return;
        }
        if (isInEditMode(editor)) {
            if (line.trim().length === 0 && editor.buffer.length === 0) {
                cancelEdit(editor);
                updatePrompt();
            }
            else {
                appendLine(editor, line);
            }
            rl.prompt();
            return;
        }
        // Skill instance resume — skill is paused awaiting user decision
        if (state.__pendingSkillResume) {
            const { instanceId, skillName } = state.__pendingSkillResume;
            const input = line.trim();
            if (input === '/cancel' || input === 'cancel') {
                console.log(infoLine(`已取消 skill: ${skillName}`));
                skillInstances.cancel(instanceId);
                state.__pendingSkillResume = undefined;
                state.__pendingQuestions = undefined;
                rl.prompt();
                return;
            }
            // Resume the paused skill instance with user's answer
            state.__pendingSkillResume = undefined;
            state.__pendingQuestions = undefined;
            const instance = skillInstances.get(instanceId);
            if (instance) {
                console.log(infoLine(`→ 继续执行 skill: ${chalk.bold(skillName)}`));
                startSpinner(`${skillName} 继续处理...`);
                await instance.execute().catch(() => {
                    stopSpinner();
                    console.log(errorLine(`Skill ${skillName} 恢复执行失败`));
                });
            }
            else {
                console.log(errorLine(`Skill 实例 ${instanceId.slice(0, 8)} 不存在或已过期`));
            }
            rl.prompt();
            return;
        }
        // Feature 1 (P5): Pending AskUserQuestion — treat input as answer
        if (state.__pendingQuestions) {
            const input = line.trim();
            if (input === '/cancel' || input === 'cancel') {
                console.log(infoLine('已取消提问。'));
                state.__pendingQuestions = undefined;
                rl.prompt();
                return;
            }
            // Parse simple answer format
            await handleAskUserAnswer(input);
            rl.prompt();
            return;
        }
        const cmd = parseInput(line);
        await handleCommand(cmd);
        if (state.exiting)
            return;
        rl.prompt();
    });
    process.stdin.on('keypress', (_str, key) => {
        if (!key)
            return;
        const action = resolveKeyAction(_str, key, isInEditMode(editor));
        // ── Shift+Tab: cycle chat mode ──
        if (action.type === 'cycleMode') {
            const nextMode = cycleMode(state.modeState.currentMode);
            // v3: Craft mode also needs confirmation via shortcut
            if (nextMode === 'craft' && !state.hasCraftConfirmed) {
                void (async () => {
                    // Print warning context before asking confirmation (matching /mode craft behaviour)
                    console.log(warnLine('Craft 模式允许 AI 自由读写文件。'));
                    const confirmed = await confirmCraftMode(rl);
                    if (!confirmed) {
                        console.log(infoLine('已取消，保持在当前模式'));
                        rl.prompt();
                        return;
                    }
                    state.hasCraftConfirmed = true;
                    saveSettings({ hasCraftConfirmed: true }); // v5: persist across sessions
                    await switchMode(nextMode, 'shortcut');
                    console.log(okLine(`已切换到: ${renderModeBadge(nextMode)}`));
                    rl.prompt();
                })();
            }
            else {
                void (async () => {
                    await switchMode(nextMode, 'shortcut');
                    // Print feedback so the user knows the mode changed (matching /mode command behaviour)
                    const badge = renderModeBadge(nextMode);
                    if (badge)
                        console.log(okLine(`已切换到: ${badge}`));
                    rl.prompt();
                })();
            }
            return;
        }
        if (action.type === 'submit' && isInEditMode(editor)) {
            const fullText = getFullText(editor);
            cancelEdit(editor);
            updatePrompt();
            process.stdout.write('\n' + chalk.dim(`  → ${fullText.slice(0, 80)}${fullText.length > 80 ? '...' : ''}`) + '\n');
            const cmd = parseInput(fullText);
            void (async () => {
                await handleCommand(cmd);
                if (!state.exiting)
                    rl.prompt();
            })();
        }
        if (action.type === 'cancel' && isInEditMode(editor)) {
            cancelEdit(editor);
            updatePrompt();
            console.log(warnLine('已取消'));
            rl.prompt();
        }
    });
    rl.on('SIGINT', () => {
        if (isInEditMode(editor)) {
            cancelEdit(editor);
            updatePrompt();
            ctrlCCount = 0;
            console.log(warnLine('已取消'));
            rl.prompt();
            return;
        }
        ctrlCCount++;
        if (ctrlCCount >= 2) {
            console.log(infoLine('\n正在退出...'));
            void saveAndExit();
        }
        else {
            console.log(warnLine('\n再按一次 Ctrl+C 退出 (1 秒内)'));
            resetCtrlC();
            ctrlCTimer = setTimeout(resetCtrlC, 1000);
            rl.prompt();
        }
    });
    rl.on('close', () => {
        console.log(chalk.dim('\n  CodeSquad REPL 已退出。\n'));
        process.exit(0);
    });
    // ── Start ──
    console.log(renderBanner(pkg.version));
    // Provider status
    const ollamaAvailable = await detectOllama();
    console.log(renderProviderStatus(state.providerId ?? undefined, state.modelId ?? undefined, ollamaAvailable));
    // ── Status Line ──
    const status = getStatusLine(PROJECT_ROOT, state.modelId ?? 'Unknown', null);
    console.log(chalk.dim(`  ${formatStatusLine(status)}\n`));
    console.log(chalk.dim('  输入 @agent-name 开始对话，/help 查看帮助\n'));
    rl.prompt();
}
//# sourceMappingURL=index.js.map