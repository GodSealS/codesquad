/**
 * Hook registry — auto-detects platform and selects the best executor.
 *
 * Priority: env var → user config → platform detection.
 * Phase 1.5 — Steps 1.5.2, 1.5.4, 1.5.5.
 */
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ALL_EXECUTORS } from './executors.js';
import { virtualExists } from '../embedded/virtual-fs.js';
// ── State ──
let _detectedExecutors = null;
let _preferredInterpreter = null;
// ── Path helpers ──
//
// Resolve HOOK_DIR relative to the CLI package root, NOT to the user's cwd.
// This way `codesquad repl` works regardless of which directory the user is in.
//
// Layout: <pkg>/src/hooks/registry.ts  →  <pkg>/AICore/hooks/
const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..', '..');
const HOOK_DIR = join(PKG_ROOT, 'AICore', 'hooks');
/**
 * Find the hook file matching the executor's extension.
 * Falls back to .sh if the executor supports it.
 */
export function findHookFile(hookName, executor) {
    const primary = join(HOOK_DIR, `${hookName}${executor.extension}`);
    if (virtualExists(primary))
        return primary;
    // Fallback: try .sh for executors that can run shell
    if (executor.extension !== '.sh' && executor.canRunShell) {
        const fallback = join(HOOK_DIR, `${hookName}.sh`);
        if (virtualExists(fallback))
            return fallback;
    }
    return null;
}
/**
 * Detect available executors on this platform.
 *
 * Result is cached, but the cache is keyed by ALL_EXECUTORS order so that
 * a fresh detect() runs if the executor list ever changes (e.g., new
 * executors are registered). This avoids the "empty cache" trap where a
 * system with no executors available at first launch permanently disables
 * hooks (D9).
 */
export async function detectExecutors() {
    const signature = ALL_EXECUTORS.map((e) => e.interpreter).join(',');
    if (_detectedExecutors && _detectedExecutors.signature === signature) {
        return _detectedExecutors.executors;
    }
    const results = [];
    for (const executor of ALL_EXECUTORS) {
        if (await executor.detect()) {
            results.push(executor);
        }
    }
    _detectedExecutors = { signature, executors: results };
    return results;
}
/**
 * Invalidate the executor detection cache.
 * Call this when a hook interpreter may have been installed at runtime,
 * so subsequent hook executions can pick it up.
 */
export function invalidateExecutorCache() {
    _detectedExecutors = null;
}
/**
 * Get the best available executor.
 * Priority: CODESQUAD_HOOK_INTERPRETER env var → first detected executor.
 */
export async function getPreferredExecutor() {
    if (_preferredInterpreter) {
        const match = ALL_EXECUTORS.find((e) => e.interpreter === _preferredInterpreter);
        if (match && (await match.detect()))
            return match;
    }
    const envInterpreter = process.env.CODESQUAD_HOOK_INTERPRETER;
    if (envInterpreter) {
        const match = ALL_EXECUTORS.find((e) => e.interpreter === envInterpreter);
        if (match && (await match.detect()))
            return match;
    }
    const executors = await detectExecutors();
    return executors[0] ?? null;
}
/**
 * Run a hook by name.
 */
export async function runHook(hookName, input, options) {
    const executor = await getPreferredExecutor();
    if (!executor) {
        return { result: null, available: false };
    }
    const hookPath = findHookFile(hookName, executor);
    if (!hookPath) {
        return { result: null, available: false };
    }
    const result = await executor.execute(hookPath, input, options);
    return { result, available: true };
}
/**
 * Check if any hook interpreter is available.
 */
export async function hasAnyInterpreter() {
    const executors = await detectExecutors();
    return executors.length > 0;
}
/**
 * Render the Windows no-interpreter guide.
 */
export function renderNoInterpreterGuide() {
    return `
⚠️  Hook 运行时检测中...

❌ 警告: 未检测到 Git Bash、WSL 或 PowerShell
   Hook 脚本无法直接执行

推荐方案:
  1. 安装 Git for Windows: https://git-scm.com/download/win
     安装时勾选 "Use Git from Windows Command Prompt"
  2. 或安装 WSL: wsl --install
  3. 或安装 PowerShell 7: winget install Microsoft.PowerShell

您仍可使用 REPL，但以下 hook 将不可用:
  - session-start (项目上下文检测)
  - validate-commit (提交前检查)

是否继续? [y/N]
`;
}
//# sourceMappingURL=registry.js.map