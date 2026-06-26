/**
 * Hook executor — standardized NDJSON protocol with timeout control.
 *
 * Each platform executor (bash, powershell, etc.) implements this interface.
 * Phase 1.5 — Step 1.5.1.
 */
export interface HookResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
    timedOut: boolean;
}
export interface HookOptions {
    timeout?: number;
    cwd?: string;
    env?: Record<string, string>;
}
export interface HookExecutor {
    interpreter: string;
    extension: string;
    /** Check if this executor is available on the current platform. */
    detect(): Promise<boolean>;
    /** Execute a hook script with optional JSON input via NDJSON. */
    execute(hookPath: string, input?: object, options?: HookOptions): Promise<HookResult>;
    /** Whether this executor can run .sh scripts as fallback. */
    canRunShell: boolean;
}
//# sourceMappingURL=runner.d.ts.map