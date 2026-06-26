/**
 * Hook executor implementations for each platform.
 * Phase 1.5 — Steps 1.5.2-1.5.3.
 */
import { spawn } from 'child_process';
// ── Base spawn helper ──
async function spawnHook(cmd, args, hookPath, input, options) {
    const timeout = options?.timeout ?? 10000;
    const cwd = options?.cwd ?? process.cwd();
    const env = { ...process.env, ...options?.env };
    const start = Date.now();
    return new Promise((resolve) => {
        let timedOut = false;
        let stdout = '';
        let stderr = '';
        const allArgs = [...args, hookPath];
        if (input) {
            allArgs.push(JSON.stringify(input));
        }
        const proc = spawn(cmd, allArgs, {
            cwd,
            env,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
        });
        const timer = setTimeout(() => {
            timedOut = true;
            proc.kill('SIGKILL');
        }, timeout);
        proc.stdout?.on('data', (data) => {
            stdout += data.toString();
        });
        proc.stderr?.on('data', (data) => {
            stderr += data.toString();
        });
        proc.on('close', (exitCode) => {
            clearTimeout(timer);
            resolve({
                exitCode: exitCode ?? (timedOut ? 124 : 1),
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                duration: Date.now() - start,
                timedOut,
            });
        });
        proc.on('error', () => {
            clearTimeout(timer);
            resolve({
                exitCode: 1,
                stdout,
                stderr: `Failed to spawn ${cmd}`,
                duration: Date.now() - start,
                timedOut: false,
            });
        });
    });
}
// ── Bash executor (Linux, macOS, Git Bash on Windows) ──
export const bashExecutor = {
    interpreter: 'bash',
    extension: '.sh',
    canRunShell: true,
    async detect() {
        try {
            const result = await spawnHook('bash', ['--version'], '', undefined, { timeout: 3000 });
            return result.exitCode === 0;
        }
        catch {
            return false;
        }
    },
    async execute(hookPath, input, options) {
        return spawnHook('bash', [], hookPath, input, options);
    },
};
// ── PowerShell executor (Windows native .ps1) ──
async function detectPwsh() {
    // Try pwsh (PowerShell 7+) first, then powershell (5.1)
    for (const cmd of ['pwsh.exe', 'powershell.exe']) {
        try {
            const result = await spawnHook(cmd, ['-Command', 'exit 0'], '', undefined, { timeout: 3000 });
            if (result.exitCode === 0)
                return cmd;
        }
        catch {
            continue;
        }
    }
    return null;
}
let _pwshPath;
export const powershellExecutor = {
    interpreter: 'powershell',
    extension: '.ps1',
    canRunShell: false,
    async detect() {
        if (_pwshPath === undefined) {
            _pwshPath = await detectPwsh();
        }
        return _pwshPath !== null;
    },
    async execute(hookPath, input, options) {
        if (_pwshPath === undefined) {
            _pwshPath = await detectPwsh();
        }
        const pwsh = _pwshPath ?? 'powershell.exe';
        return spawnHook(pwsh, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File'], hookPath, input, options);
    },
};
// ── WSL executor (Windows Subsystem for Linux) ──
export const wslExecutor = {
    interpreter: 'wsl',
    extension: '.sh',
    canRunShell: true,
    async detect() {
        try {
            const result = await spawnHook('wsl.exe', ['bash', '-c', 'exit 0'], '', undefined, { timeout: 5000 });
            return result.exitCode === 0;
        }
        catch {
            return false;
        }
    },
    async execute(hookPath, input, options) {
        // Convert Windows path to WSL path
        const wslPath = hookPath
            .replace(/^([A-Z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`)
            .replace(/\\/g, '/');
        return spawnHook('wsl.exe', ['bash'], wslPath, input, options);
    },
};
// ── CMD executor (Windows .bat) ──
export const cmdExecutor = {
    interpreter: 'cmd',
    extension: '.bat',
    canRunShell: false,
    async detect() {
        return process.platform === 'win32';
    },
    async execute(hookPath, input, options) {
        return spawnHook('cmd.exe', ['/c'], hookPath, input, options);
    },
};
// ── All executors in priority order ──
export const ALL_EXECUTORS = [
    bashExecutor,
    powershellExecutor,
    wslExecutor,
    cmdExecutor,
];
//# sourceMappingURL=executors.js.map