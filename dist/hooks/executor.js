/**
 * Hook execution engine — runs hooks at lifecycle events.
 *
 * References:
 *   Claude Code src/utils/hooks.ts — getMatchingHooks, executePreToolHooks, etc.
 *
 * Phase 2.2
 */
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { DEFAULT_HOOK_TIMEOUT } from './types.js';
const execAsync = promisify(exec);
// ── Hook Registry ──
let _hooksSettings = {};
let _executedOnceHooks = new Set();
/** Load hooks configuration (from AICore/settings.json or programmatic). */
export function loadHooksConfig(config) {
    _hooksSettings = config;
}
/** Register a single hook config for an event. */
export function registerHook(event, config) {
    if (!_hooksSettings[event]) {
        _hooksSettings[event] = [];
    }
    _hooksSettings[event].push(config);
}
/** Reset hook state (called on /clear or new session). */
export function resetHookState() {
    _executedOnceHooks = new Set();
}
// ── Hook Matching ──
/**
 * Find all hook configs that match an event and optional tool matcher.
 */
export function getMatchingHooks(event, toolName) {
    const configs = _hooksSettings[event];
    if (!configs || configs.length === 0)
        return [];
    return configs.filter((config) => {
        // Check matcher
        if (!config.matcher || config.matcher === '')
            return true;
        if (!toolName)
            return false;
        // Support pipe-separated matchers: "Write|Edit"
        const matchers = config.matcher.split('|');
        return matchers.some((m) => {
            if (m === toolName)
                return true;
            if (m === '*')
                return true;
            return false;
        });
    }).filter((config) => {
        // Filter hooks
        return config.hooks.some((h) => {
            // Check 'once' flag
            if (h.once) {
                const key = `${event}:${config.matcher}:${h.type}`;
                if (_executedOnceHooks.has(key))
                    return false;
            }
            return true;
        });
    });
}
// ── Hook Execution ──
/**
 * Execute all hooks matching an event/tool combination.
 * Returns combined result — 'block' beats 'approve' beats 'allow'.
 */
export async function executeHooks(event, toolName, input) {
    const configs = getMatchingHooks(event, toolName);
    if (configs.length === 0) {
        return { available: false, decision: 'allow' };
    }
    const results = [];
    for (const config of configs) {
        for (const hookDef of config.hooks) {
            // Check 'if' condition
            if (hookDef.if && !evaluateHookCondition(hookDef.if, toolName, input)) {
                continue;
            }
            // Check 'once'
            const onceKey = `${event}:${config.matcher}:${hookDef.type}`;
            if (hookDef.once && _executedOnceHooks.has(onceKey)) {
                continue;
            }
            if (hookDef.once) {
                _executedOnceHooks.add(onceKey);
            }
            // Execute hook
            const hook = {
                type: hookDef.type,
                ...(hookDef.type === 'command' ? { command: hookDef.command, timeout: hookDef.timeout || DEFAULT_HOOK_TIMEOUT.command } : {}),
                ...(hookDef.type === 'prompt' ? { prompt: hookDef.prompt, timeout: hookDef.timeout || DEFAULT_HOOK_TIMEOUT.prompt } : {}),
                ...(hookDef.type === 'agent' ? { prompt: hookDef.prompt, timeout: hookDef.timeout || DEFAULT_HOOK_TIMEOUT.agent } : {}),
            };
            try {
                const result = await executeHook(hook, input);
                results.push(result);
            }
            catch (err) {
                results.push({
                    available: true,
                    decision: 'allow', // Hook errors should not block
                    error: err.message,
                });
            }
        }
    }
    return mergeHookResults(results);
}
/**
 * Execute a single hook.
 */
async function executeHook(hook, input) {
    switch (hook.type) {
        case 'command':
            return executeCommandHook(hook, input);
        case 'prompt':
            return executePromptHook(hook, input);
        case 'agent':
            return executeAgentHook(hook, input);
        default:
            return { available: false, decision: 'allow' };
    }
}
// ── Command Hook Execution ──
async function executeCommandHook(hook, input) {
    const timeout = hook.timeout || DEFAULT_HOOK_TIMEOUT.command;
    // Check if the command interpreter exists (e.g. "bash" on Windows may not be available).
    // Extract first word: "bash AICore/hooks/validate-commit.sh" → "bash"
    const interpreter = hook.command.split(/\s+/)[0];
    const interpreterMissing = await isInterpreterMissing(interpreter);
    if (interpreterMissing) {
        return {
            available: true,
            decision: 'allow',
            exitCode: 0,
            error: `Hook interpreter not found: ${interpreter} — skipping hook: ${hook.command}`,
        };
    }
    // Build environment with hook input
    const env = { ...process.env };
    if (input?.tool_name)
        env['CODESQUAD_TOOL_NAME'] = input.tool_name;
    if (input?.command)
        env['CODESQUAD_COMMAND'] = input.command;
    if (input?.agent_name)
        env['CODESQUAD_AGENT'] = input.agent_name;
    if (input?.session_id)
        env['CODESQUAD_SESSION_ID'] = input.session_id;
    // Use shell:true so Node.js handles quoting natively — no manual escaping needed.
    // This avoids command injection via unescaped $(), backticks, etc.
    const child = spawn(hook.command, [], {
        timeout: timeout * 1000,
        env,
        windowsHide: true,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (data) => { stdout += data.toString(); });
        child.stderr?.on('data', (data) => { stderr += data.toString(); });
        child.on('close', (exitCode, signal) => {
            if (exitCode === 0 && !signal) {
                resolve({
                    available: true,
                    decision: parseHookExitCode(0),
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    exitCode: 0,
                });
            }
            else {
                const code = signal ? 2 : (exitCode ?? 1);
                resolve({
                    available: true,
                    decision: parseHookExitCode(code),
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    exitCode: code,
                    error: signal ? `Command killed by signal ${signal}` : `Command exited with code ${exitCode}`,
                });
            }
        });
        child.on('error', (err) => {
            if (err.code === 'ENOENT') {
                resolve({
                    available: true,
                    decision: 'allow',
                    exitCode: 0,
                    error: `Hook command not found: ${hook.command}`,
                });
            }
            else {
                resolve({
                    available: true,
                    decision: 'block',
                    exitCode: 1,
                    error: err.message,
                });
            }
        });
    });
}
/**
 * Check if a command interpreter (e.g. "bash", "python3") is available on the system.
 * On Windows, "bash" typically requires Git Bash or WSL.
 */
async function isInterpreterMissing(cmd) {
    try {
        const checkCmd = process.platform === 'win32'
            ? `where ${cmd}` // Windows: "where bash"
            : `command -v ${cmd}`; // Unix: "command -v bash"
        await execAsync(checkCmd, { timeout: 3000, windowsHide: true, shell: true });
        return false; // Found
    }
    catch {
        return true; // Not found
    }
}
/**
 * Parse hook exit code to decision.
 *   exit 0 = allow (success)
 *   exit 1 = block (error)
 *   exit 2 = approve (needs user confirmation)
 */
function parseHookExitCode(code) {
    switch (code) {
        case 0: return 'allow';
        case 2: return 'approve';
        default: return 'block';
    }
}
// ── Prompt Hook Execution (stub) ──
async function executePromptHook(_hook, _input) {
    // Full implementation requires calling LLM with the hook prompt.
    // Phase 2 MVP: stub — treat as allow.
    return { available: true, decision: 'allow' };
}
// ── Agent Hook Execution (stub) ──
async function executeAgentHook(_hook, _input) {
    // Full implementation requires spawning a subagent.
    // Phase 6 will complete this.
    return { available: true, decision: 'allow' };
}
// ── Condition Evaluation ──
/**
 * Evaluate a hook 'if' condition using permission rule syntax.
 * e.g. "Bash(git *)" matches Bash tool with git prefix commands.
 */
function evaluateHookCondition(condition, toolName, input) {
    if (!condition || condition === '*')
        return true;
    // Parse toolName(contentPattern) format
    const match = condition.match(/^(\w+)(?:\((.+)\))?$/);
    if (!match)
        return false;
    const condTool = match[1];
    const condPattern = match[2];
    // Check tool name match
    if (toolName && condTool !== toolName)
        return false;
    if (!toolName && condTool !== '*')
        return false;
    // Check content pattern
    if (!condPattern)
        return true;
    if (condPattern === '*')
        return true;
    // Check command field for Bash hooks
    // Support glob *: "git commit*" should match "git commit", "git commit -m ..."
    const cmd = input?.command || '';
    if (condPattern.includes('*')) {
        const prefix = condPattern.replace(/\*/g, '');
        if (cmd.startsWith(prefix))
            return true;
    }
    else if (cmd.startsWith(condPattern)) {
        return true;
    }
    return false;
}
// ── Result Merging ──
/**
 * Merge multiple hook results into one.
 * Priority: block > approve > allow
 */
function mergeHookResults(results) {
    if (results.length === 0) {
        return { available: false, decision: 'allow' };
    }
    if (results.length === 1) {
        return results[0];
    }
    // Merge: highest severity wins
    const hasBlock = results.some((r) => r.decision === 'block');
    const hasApprove = results.some((r) => r.decision === 'approve');
    const reasons = results
        .filter((r) => r.reason)
        .map((r) => r.reason)
        .join('; ');
    // Combine stdout/stderr
    const stdout = results
        .filter((r) => r.stdout)
        .map((r) => r.stdout)
        .join('\n');
    const stderr = results
        .filter((r) => r.stderr)
        .map((r) => r.stderr)
        .join('\n');
    // Custom instructions from PreCompact hooks
    const customInstructions = results
        .filter((r) => r.newCustomInstructions)
        .map((r) => r.newCustomInstructions)
        .join('\n');
    // User messages
    const userMessages = results
        .filter((r) => r.userMessage)
        .map((r) => r.userMessage)
        .join('\n');
    return {
        available: true,
        decision: hasBlock ? 'block' : hasApprove ? 'approve' : 'allow',
        reason: reasons || undefined,
        stdout: stdout || undefined,
        stderr: stderr || undefined,
        newCustomInstructions: customInstructions || undefined,
        userMessage: userMessages || undefined,
        exitCode: hasBlock ? 1 : 0,
    };
}
// ── Convenience Wrappers ──
/** Execute PreToolUse hooks for a specific tool. Returns 'block' if any hook blocks. */
export async function executePreToolHooks(toolName, input) {
    return executeHooks('PreToolUse', toolName, input);
}
/** Execute PostToolUse hooks after tool success. */
export async function executePostToolHooks(toolName, input) {
    return executeHooks('PostToolUse', toolName, input);
}
/** Execute PostToolUseFailure hooks after tool error. */
export async function executePostToolUseFailureHooks(toolName, input) {
    return executeHooks('PostToolUseFailure', toolName, input);
}
/** Execute SessionStart hooks. */
export async function executeSessionStartHooks(source = 'startup') {
    return executeHooks('SessionStart', undefined, { source });
}
/** Execute Stop hooks. */
export async function executeStopHooks(sessionId) {
    // P1 fix: Don't execute Stop hooks if there's a pending user question.
    if (_hasPendingUserQuestion(sessionId)) {
        return { decision: 'allow', reason: 'Stop hooks skipped — pending user question', available: false };
    }
    return executeHooks('Stop');
}
/** Check if an AskUserQuestion is pending (avoid Stop hook interfering). */
// Per-session pending state (keyed by sessionId to avoid cross-session contamination)
const _pendingBySession = new Map();
let _globalPending = false; // fallback for callers without sessionId
export function setPendingUserQuestion(pending, sessionId) {
    if (sessionId) {
        const prev = _pendingBySession.get(sessionId) ?? false;
        _pendingBySession.set(sessionId, pending);
        return prev;
    }
    const prev = _globalPending;
    _globalPending = pending;
    return prev;
}
function _hasPendingUserQuestion(sessionId) {
    if (sessionId)
        return _pendingBySession.get(sessionId) ?? false;
    return _globalPending;
}
/** Execute PreCompact hooks. Returns custom instructions if any. */
export async function executePreCompactHooks(customInstructions) {
    return executeHooks('PreCompact', undefined, { custom_instructions: customInstructions });
}
/** Execute PostCompact hooks. */
export async function executePostCompactHooks() {
    return executeHooks('PostCompact');
}
/** Execute SubagentStart hooks. */
export async function executeSubagentStartHooks(agentName) {
    return executeHooks('SubagentStart', undefined, { agent_name: agentName });
}
/** Execute SubagentStop hooks. */
export async function executeSubagentStopHooks(agentName) {
    return executeHooks('SubagentStop', undefined, { agent_name: agentName });
}
/** Execute PermissionRequest hooks. */
export async function executePermissionRequestHooks(toolName, input) {
    return executeHooks('PermissionRequest', toolName, input);
}
//# sourceMappingURL=executor.js.map