/**
 * Hook registry — auto-detects platform and selects the best executor.
 *
 * Priority: env var → user config → platform detection.
 * Phase 1.5 — Steps 1.5.2, 1.5.4, 1.5.5.
 */
import type { HookExecutor, HookResult, HookOptions } from './runner.js';
/**
 * Find the hook file matching the executor's extension.
 * Falls back to .sh if the executor supports it.
 */
export declare function findHookFile(hookName: string, executor: HookExecutor): string | null;
/**
 * Detect available executors on this platform.
 *
 * Result is cached, but the cache is keyed by ALL_EXECUTORS order so that
 * a fresh detect() runs if the executor list ever changes (e.g., new
 * executors are registered). This avoids the "empty cache" trap where a
 * system with no executors available at first launch permanently disables
 * hooks (D9).
 */
export declare function detectExecutors(): Promise<HookExecutor[]>;
/**
 * Invalidate the executor detection cache.
 * Call this when a hook interpreter may have been installed at runtime,
 * so subsequent hook executions can pick it up.
 */
export declare function invalidateExecutorCache(): void;
/**
 * Get the best available executor.
 * Priority: CODESQUAD_HOOK_INTERPRETER env var → first detected executor.
 */
export declare function getPreferredExecutor(): Promise<HookExecutor | null>;
/**
 * Run a hook by name.
 */
export declare function runHook(hookName: string, input?: object, options?: HookOptions): Promise<{
    result: HookResult | null;
    available: boolean;
}>;
/**
 * Check if any hook interpreter is available.
 */
export declare function hasAnyInterpreter(): Promise<boolean>;
/**
 * Render the Windows no-interpreter guide.
 */
export declare function renderNoInterpreterGuide(): string;
//# sourceMappingURL=registry.d.ts.map