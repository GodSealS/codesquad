/**
 * BashTool — execute shell commands with safety constraints.
 *
 * v2 Upgrade:
 *   - exec() → spawn() for proper process tree management
 *   - Platform-specific tree-kill (taskkill on Win, SIGTERM/SIGKILL on Unix)
 *   - Timeout auto-backgrounding (command continues running if it times out)
 *   - Output persistence (large output → temp file, returns file path)
 *   - Progress callbacks via onProgress
 *
 * References:
 *   Claude Code src/tools/BashTool/BashTool.ts (820+ lines)
 *   Claude Code src/utils/Shell.ts
 *
 * Phase 2.0
 */
import { spawn } from 'child_process';
import { writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { z } from 'zod';
import { buildTool } from './types.js';
import { matchesRule } from './types.js';
import { classifyCommand, safetyHint } from './command-classifier.js';
// ── Schema ──
export const BashInputSchema = z.object({
    command: z.string().min(1).max(10000).describe('The shell command to execute'),
    timeout: z.number().int().min(1).max(600).optional().default(120).describe('Timeout in seconds (max 600)'),
    description: z.string().max(200).optional().describe('Human-readable description of what the command does'),
    runInBackground: z.boolean().optional().default(false).describe('Start the command in background immediately'),
});
// ── Constants ──
const MAX_OUTPUT_CHARS = 30_000;
const MAX_OUTPUT_CHARS_PERSIST = 10_000;
/** Threshold for persisting to temp file (in chars). */
const PERSIST_THRESHOLD_CHARS = 30_000;
/** Maximum bytes for background task output file. */
const MAX_PERSISTED_BYTES = 64 * 1024 * 1024; // 64 MB
/** Progress report threshold (ms). */
const PROGRESS_THRESHOLD_MS = 2000;
// ── Background task registry ──
const backgroundTasks = new Map();
export function getBackgroundTasks() {
    return Array.from(backgroundTasks.values()).map(entry => entry.task);
}
// ── Command safety lists ──
/** Commands that are always allowed (read-only or safe). */
const ALWAYS_ALLOWED_PREFIXES = [
    'git status', 'git diff', 'git log', 'git branch', 'git rev-parse',
    'git show', 'git stash list',
    'ls ', 'dir ', 'echo ',
    'npm run build', 'npm run test', 'npm run lint',
    'npx vitest', 'npx tsc', 'npx eslint',
    'npx prettier', 'npx jest',
    'node ', 'python ', 'py ',
    'cat ', 'type ', 'head ', 'tail ',
    'find ', 'grep ', 'rg ',
    'wc ', 'du ', 'df ',
    'printenv', 'which ', 'where ',
    'npm list', 'npm view', 'npm info',
    'mkdir ', 'New-Item ',
];
/** Commands that are always denied (destructive or unsafe). */
const ALWAYS_DENIED_PATTERNS = [
    /^rm\s+-rf/i, /^rm\s+-r\s+-f/i,
    /^sudo\s/i,
    /^chmod\s+777/i,
    /^git\s+push\s+(-\w+\s+)*--force/i,
    /^git\s+reset\s+--hard/i,
    /^git\s+clean\s+-f/i,
    /^curl\s/i, /^wget\s/i,
    /\.env/i,
    /^shutdown/i,
    /^reboot/i,
    /^format\s/i,
    /^mkfs/i,
    /^dd\s/i,
];
/** Commands categorised for prompt hints. */
const ENGINE_BUILD_COMMANDS = [
    'dotnet build', 'msbuild', 'xcodebuild',
    'godot', 'RunUAT', 'cocos',
];
// ── Shell detection ──
let _detectedShell = null;
function detectShell() {
    if (_detectedShell)
        return _detectedShell;
    if (process.platform === 'win32') {
        if (process.env.PATHEXT?.includes('.ps1') || process.env.ProgramFiles) {
            _detectedShell = 'powershell.exe';
        }
        else {
            _detectedShell = 'cmd.exe';
        }
    }
    else {
        _detectedShell = process.env.SHELL || '/bin/sh';
    }
    return _detectedShell;
}
// ── Windows command translation ──
function translateForWindows(command) {
    if (process.platform !== 'win32')
        return command;
    let cmd = command.trim();
    // Step 1: normalize redirects to PowerShell syntax.
    // The AI often mixes CMD (2>nul) and Unix (2>/dev/null) in one
    // "cross-platform" command, which causes "StreamAlreadyRedirected"
    // when both land in PowerShell.  Normalize everything to 2>$null
    // and deduplicate so only one redirect survives.
    cmd = cmd.replace(/2>\/dev\/null/g, '2>$null');
    cmd = cmd.replace(/2>nul\b/gi, '2>$null');
    // deduplicate consecutive 2>$null runs (e.g. 2>$null 2>$null → 2>$null)
    cmd = cmd.replace(/(2>\$null\s*)+/g, '2>$null ');
    // Step 2: handle shell-OR (||) and shell-AND (&&) —
    // PowerShell 5.x doesn't support && / ||, translate both before
    // any command translations.
    if (cmd.includes('||') || cmd.includes('&&')) {
        // Translate && first (→ ; if ($LASTEXITCODE -eq 0) { ... }),
        // then || (→ ; if ($LASTEXITCODE -ne 0) { ... }).
        cmd = cmd.replace(/&&\s*/g, '; if ($LASTEXITCODE -eq 0) { ');
        cmd = cmd.replace(/\|\|\s*/g, '; if ($LASTEXITCODE -ne 0) { ');
        const openBraces = (cmd.match(/\{/g) || []).length;
        const closeBraces = (cmd.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
            cmd += ' }'.repeat(openBraces - closeBraces);
        }
        return cmd;
    }
    // Step 3: translate Unix commands (only when they start the command)
    const mkdirMatch = cmd.match(/^mkdir\s+(?:-p\s+)?(.+)$/i);
    if (mkdirMatch) {
        const target = mkdirMatch[1].trim();
        return `New-Item -ItemType Directory -Force -Path '${psEscape(target)}' | Out-Null`;
    }
    const lsMatch = cmd.match(/^ls\s+(?:-la\s+)?(.+)$/i);
    if (lsMatch) {
        return `Get-ChildItem '${psEscape(lsMatch[1].trim())}'`;
    }
    if (/^ls$/i.test(cmd))
        return 'Get-ChildItem';
    // Fix: use non-greedy (\S+) for filename — prevents capturing || and other suffixes
    const catMatch = cmd.match(/^cat\s+(\S+)(.*)$/i);
    if (catMatch) {
        const filename = catMatch[1].trim();
        const rest = catMatch[2] ?? '';
        return `Get-Content '${psEscape(filename)}'${rest}`;
    }
    return cmd;
}
// ── Spawn + process tree kill helpers ──
/**
 * Spawn a shell process and return the ChildProcess + a kill-tree function.
 */
function spawnWithTreeKill(command, shell, cwd) {
    const shellArgs = process.platform === 'win32'
        ? (shell.endsWith('powershell.exe') ? ['-NoProfile', '-Command', command] : ['/d', '/s', '/c', command])
        : ['-c', command];
    const proc = spawn(shell, shellArgs, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        env: { ...process.env },
    });
    const killTree = () => {
        if (!proc.pid)
            return;
        if (process.platform === 'win32') {
            // Windows: use taskkill /T to kill process tree
            spawn('taskkill', ['/T', '/F', '/PID', String(proc.pid)], {
                stdio: 'ignore',
                windowsHide: true,
            }).unref();
        }
        else {
            // Unix: negative pid kills the process group
            try {
                process.kill(-proc.pid, 'SIGTERM');
            }
            catch { /* ignore */ }
            // Fallback: direct kill
            setTimeout(() => {
                try {
                    proc.kill('SIGKILL');
                }
                catch { /* ignore */ }
            }, 2000).unref();
        }
    };
    return { proc, killTree };
}
// ── Output persistence ──
let outputFileCounter = 0;
async function persistOutput(text) {
    outputFileCounter++;
    const filename = `bash-output-${Date.now()}-${outputFileCounter}.txt`;
    const filepath = join(tmpdir(), filename);
    // Truncate at MAX_PERSISTED_BYTES bytes
    const truncated = Buffer.byteLength(text, 'utf-8') > MAX_PERSISTED_BYTES
        ? text.slice(0, MAX_PERSISTED_BYTES) + '\n\n[Output truncated: exceeded 64 MB limit]'
        : text;
    await writeFile(filepath, truncated, 'utf-8');
    return filepath;
}
// ── Tool Definition ──
export const BashTool = buildTool({
    name: 'Bash',
    description: 'Execute a shell command within the project directory.',
    searchHint: 'run shell command terminal',
    inputSchema: BashInputSchema,
    maxResultSizeChars: MAX_OUTPUT_CHARS,
    isReadOnly() {
        return false;
    },
    isConcurrencySafe() {
        return false;
    },
    isDestructive() {
        return true;
    },
    prompt() {
        const buildCmdHints = ENGINE_BUILD_COMMANDS
            .map(c => `  - \`${c}\``)
            .join('\n');
        return [
            '## Bash Tool',
            '',
            'Execute shell commands in the project directory.',
            'Command results are truncated after 30KB.',
            '',
            '**Engine build commands (allowed):**',
            buildCmdHints,
            '',
            '**Allowed operations**: git status/diff/log, npm scripts, ls/dir, cat, find, grep.',
            '**Denied operations**: rm -rf, sudo, chmod 777, git push --force, curl/wget, .env access.',
            '',
            '**Command classification (automatic):**',
            '  - `safe`: read-only, git-read, build, test — auto-allowed',
            '  - `cautious`: engine-build, git-write, network, package — may be allowed',
            '  - `dangerous`: rm -rf, sudo, dd — always denied',
            '',
            'Set `runInBackground: true` for long-running builds or servers.',
            'When a command times out, it may be backgrounded automatically (status shown).',
            'Use `getBackgroundTasks()` to check running background tasks.',
        ].join('\n');
    },
    descriptionFor(input) {
        return input.description || `Run: \`${truncateCommand(input.command)}\``;
    },
    validateInput(input, _context) {
        const cmd = input.command.trim();
        if (!cmd) {
            return { valid: false, message: 'Command is empty' };
        }
        if (cmd.length > 10000) {
            return { valid: false, message: 'Command exceeds 10000 character limit' };
        }
        return { valid: true };
    },
    checkPermissions(input, context) {
        const cmd = input.command.trim();
        // 0. Split into sub-commands and check each one against deny-lists
        //    This prevents "git status; curl http://evil" from bypassing via
        //    the git prefix whitelist.
        const subCommands = splitCommands(cmd);
        for (const subCmd of subCommands) {
            // 1. Check always-denied (per sub-command)
            for (const pattern of ALWAYS_DENIED_PATTERNS) {
                if (pattern.test(subCmd)) {
                    return {
                        behavior: 'deny',
                        message: `Command "${truncateCommand(subCmd)}" is blocked by safety rules.`,
                    };
                }
            }
            // 4b. Command classifier — auto-deny dangerous (per sub-command)
            const classification = classifyCommand(subCmd);
            if (classification.safety === 'dangerous') {
                return {
                    behavior: 'deny',
                    message: `[${safetyHint(classification)}] "${truncateCommand(subCmd)}" rated dangerous.`,
                };
            }
        }
        // 2. Check always-allowed (on full command — maintain backward compat
        //    for simple single-command cases)
        for (const prefix of ALWAYS_ALLOWED_PREFIXES) {
            if (cmd.toLowerCase().startsWith(prefix.toLowerCase())) {
                return { behavior: 'allow' };
            }
        }
        // 3. Check engine build commands
        for (const prefix of ENGINE_BUILD_COMMANDS) {
            if (cmd.toLowerCase().startsWith(prefix.toLowerCase())) {
                return { behavior: 'allow' };
            }
        }
        // 4a. Command classifier — auto-allow safe (on full command)
        const classification = classifyCommand(cmd);
        if (classification.safety === 'safe') {
            return { behavior: 'allow' };
        }
        // 5. Check custom permission rules from settings
        const rules = getPermissionRules(context);
        for (const rule of rules) {
            if (matchesRule(rule, 'Bash', { command: cmd })) {
                return {
                    behavior: rule.behavior,
                    message: rule.behavior === 'deny'
                        ? `Denied by rule: Bash(${rule.contentPattern || '*'})`
                        : undefined,
                };
            }
        }
        // 6. Plan mode: only allow commands with read-only prefixes
        if (context.permissionMode === 'plan') {
            return {
                behavior: 'deny',
                message: 'Bash tool is not available in Plan mode.',
            };
        }
        // 7. Default: ask for permission (safe-by-default)
        return {
            behavior: 'ask',
            message: `Command "${truncateCommand(cmd)}" is not in the allow list. ${safetyHint(classification)}`,
        };
    },
    async call(input, context) {
        const cwd = context.projectRoot;
        const command = translateForWindows(input.command);
        const shell = detectShell();
        const timeoutMs = (input.timeout || 120) * 1000;
        const startTime = Date.now();
        // ── Immediate background mode ──
        if (input.runInBackground) {
            const taskId = startBackgroundTask(command, cwd, shell);
            return {
                toolCallId: '',
                output: { stdout: '', stderr: '', exitCode: 0, backgroundTaskId: taskId },
                content: `[Background] Task ${taskId} started: \`${truncateCommand(command)}\``,
            };
        }
        const { proc, killTree } = spawnWithTreeKill(command, shell, cwd);
        // ── Collect output ──
        let stdout = '';
        let stderr = '';
        proc.stdout?.on('data', (data) => {
            stdout += data.toString();
        });
        proc.stderr?.on('data', (data) => {
            stderr += data.toString();
        });
        // ── Progress reporting ──
        const progressTimer = setTimeout(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            if (context.onProgress) {
                context.onProgress(`[Bash] Running \`${truncateCommand(command, 40)}\` (${elapsed}s, ${stdout.length} chars output)`);
            }
        }, PROGRESS_THRESHOLD_MS);
        // ── Timeout handling ──
        // Capture the task ID in a shared closure variable so the close handler
        // can reference it reliably even with concurrent background tasks.
        let backgroundTaskId;
        const timeoutTimer = setTimeout(() => {
            if (context.onProgress) {
                context.onProgress(`[Bash] Command timed out after ${input.timeout || 120}s — backgrounding`);
            }
            // Background the command instead of killing it
            backgroundTaskId = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            backgroundTasks.set(backgroundTaskId, { proc, killTree, task: {
                    taskId: backgroundTaskId,
                    pid: proc.pid ?? -1,
                    command: truncateCommand(command, 80),
                    startedAt: startTime,
                    status: 'running',
                } });
            // Keep collecting output via file persistence (prevents data loss after timeout)
            let bgOutput = '';
            proc.stdout?.removeAllListeners('data');
            proc.stdout?.on('data', (data) => { bgOutput += data.toString(); });
            proc.stderr?.removeAllListeners('data');
            proc.stderr?.on('data', (data) => { bgOutput += data.toString(); });
            // Persist output when process finally closes
            const persister = () => {
                if (bgOutput.length > PERSIST_THRESHOLD_CHARS) {
                    persistOutput(bgOutput).catch(() => { });
                }
            };
            proc.once('close', persister);
        }, timeoutMs);
        return new Promise((resolve) => {
            proc.on('close', async (exitCode) => {
                clearTimeout(progressTimer);
                clearTimeout(timeoutTimer);
                const elapsed = Date.now() - startTime;
                const backgrounded = elapsed >= timeoutMs;
                if (backgrounded) {
                    // The process was backgrounded — its output will be incomplete
                    resolve({
                        toolCallId: '',
                        output: {
                            stdout: truncateOutput(stdout),
                            stderr: truncateOutput(stderr),
                            exitCode,
                            backgrounded: true,
                            backgroundTaskId,
                        },
                        content: [
                            `[Background] Command continued running after ${input.timeout || 120}s timeout.`,
                            `Use task ID to check status.`,
                            '',
                            truncateOutput(stdout),
                            stderr ? `[stderr]\n${truncateOutput(stderr)}` : '',
                        ].filter(Boolean).join('\n'),
                        isError: exitCode !== 0 && exitCode !== null,
                    });
                    return;
                }
                // Persist large output
                let outputFilePath;
                const combinedOutput = stdout + stderr;
                if (combinedOutput.length > PERSIST_THRESHOLD_CHARS) {
                    try {
                        outputFilePath = await persistOutput(combinedOutput);
                    }
                    catch { /* fall through */ }
                }
                const toollCallResult = {
                    toolCallId: '',
                    output: {
                        stdout,
                        stderr,
                        exitCode,
                        outputFilePath,
                    },
                    content: outputFilePath
                        ? formatOutputWithFileRef(stdout, stderr, exitCode, outputFilePath, combinedOutput.length)
                        : formatOutput(stdout, stderr, exitCode),
                    isError: exitCode !== 0 && exitCode !== null,
                };
                resolve(toollCallResult);
            });
            proc.on('error', (err) => {
                clearTimeout(progressTimer);
                clearTimeout(timeoutTimer);
                resolve({
                    toolCallId: '',
                    output: { stdout: '', stderr: err.message, exitCode: 1 },
                    content: `[Spawn Error] ${err.message}`,
                    isError: true,
                });
            });
        });
    },
});
// ── Background task management ──
function startBackgroundTask(command, cwd, shell) {
    const { proc, killTree } = spawnWithTreeKill(command, shell, cwd);
    const taskId = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const task = {
        taskId,
        pid: proc.pid ?? -1,
        command: truncateCommand(command, 80),
        startedAt: Date.now(),
        status: 'running',
    };
    backgroundTasks.set(taskId, { proc, killTree, task });
    let fullOutput = '';
    proc.stdout?.on('data', (data) => { fullOutput += data.toString(); });
    proc.stderr?.on('data', (data) => { fullOutput += data.toString(); });
    proc.on('close', (code) => {
        task.status = code === 0 ? 'completed' : 'killed';
        backgroundTasks.set(taskId, { proc, killTree, task });
        // Persist output for long-running tasks
        if (fullOutput.length > PERSIST_THRESHOLD_CHARS) {
            persistOutput(fullOutput).catch(() => { });
        }
    });
    return taskId;
}
// ── Helpers ──
function truncateCommand(cmd, maxLen = 80) {
    return cmd.length > maxLen ? cmd.slice(0, maxLen) + '...' : cmd;
}
function truncateOutput(text) {
    if (text.length <= MAX_OUTPUT_CHARS_PERSIST)
        return text;
    const truncated = text.slice(0, MAX_OUTPUT_CHARS_PERSIST);
    return truncated + `\n\n[Output truncated: ${text.length - MAX_OUTPUT_CHARS_PERSIST} more characters]`;
}
function formatOutput(stdout, stderr, exitCode) {
    const lines = [];
    if (stdout) {
        const display = stdout.length > MAX_OUTPUT_CHARS
            ? stdout.slice(0, MAX_OUTPUT_CHARS) + `\n\n... (${stdout.length - MAX_OUTPUT_CHARS} more chars)`
            : stdout;
        lines.push(display);
    }
    if (stderr) {
        const display = stderr.length > 5000
            ? stderr.slice(0, 5000) + `\n\n... (${stderr.length - 5000} more chars)`
            : stderr;
        lines.push(`[stderr]\n${display}`);
    }
    if (exitCode !== null && exitCode !== 0) {
        lines.push(`\nExit code: ${exitCode}`);
    }
    return lines.join('\n') || '(no output)';
}
function formatOutputWithFileRef(stdout, stderr, exitCode, filePath, totalChars) {
    const summary = [
        `[Output size: ${totalChars} chars — persisted to file]`,
        `Full output: ${filePath}`,
        '',
        'Preview (first 10K chars):',
        stdout.slice(0, MAX_OUTPUT_CHARS_PERSIST),
        stderr ? `[stderr preview]\n${stderr.slice(0, 2000)}` : '',
        exitCode !== null && exitCode !== 0 ? `\nExit code: ${exitCode}` : '',
    ].filter(Boolean).join('\n');
    return summary;
}
// ── Permission Rules Integration ──
// Delegates to the shared pipeline rules rather than maintaining its own cache.
function getPermissionRules(_context) {
    return [];
}
export function invalidatePermissionRules() {
    // No-op: rules are managed by the permissions/pipeline.ts module.
}
// ── Command splitting (for multi-command injection prevention) ──
/**
 * Split a shell command string into individual sub-commands,
 * respecting quoted strings (single and double quotes).
 * Used to check each sub-command against whitelist/blacklist.
 */
function splitCommands(cmd) {
    const parts = [];
    let current = '';
    let quote = null;
    for (let i = 0; i < cmd.length; i++) {
        const ch = cmd[i];
        if (quote) {
            current += ch;
            if (ch === quote)
                quote = null;
        }
        else if (ch === '"' || ch === "'") {
            quote = ch;
            current += ch;
        }
        else if (ch === ';') {
            const trimmed = current.trim();
            if (trimmed)
                parts.push(trimmed);
            current = '';
        }
        else if (ch === '&' && cmd[i + 1] === '&') {
            const trimmed = current.trim();
            if (trimmed)
                parts.push(trimmed);
            current = '';
            i++; // skip second &
        }
        else if (ch === '|' && cmd[i + 1] !== '|') {
            const trimmed = current.trim();
            if (trimmed)
                parts.push(trimmed);
            current = '';
        }
        else {
            current += ch;
        }
    }
    const trimmed = current.trim();
    if (trimmed)
        parts.push(trimmed);
    return parts;
}
// ── PowerShell string escaping ──
/** Escape a value for use inside a PowerShell single-quoted string. */
function psEscape(value) {
    // PowerShell single-quoted strings don't expand variables;
    // the only character that needs escaping is the single quote itself.
    return value.replace(/'/g, "''");
}
//# sourceMappingURL=BashTool.js.map