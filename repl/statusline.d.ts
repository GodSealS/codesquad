/**
 * Status Line — project stage detection + context usage display + config-based execution.
 *
 * Replicates AICore/statusline.sh logic in TypeScript for REPL integration.
 * Shows: ctx% | model | stage [| Epic > Feature > Task]
 *
 * Feature 7 (P4): Supports external script execution with JSON input.
 *
 * Phase 7.2
 */
export interface StatusLine {
    contextPercent: number | null;
    model: string;
    stage: string;
    breadcrumb: string;
    /** Total cost from usage tracker (optional). */
    totalCost?: number;
    /** Context window usage info. */
    contextWindow?: {
        tokens: number;
        usagePercent: number;
    };
}
export interface StatusLineConfig {
    type: 'command';
    command: string;
    padding?: number;
}
/**
 * Load status line configuration from AICore/settings.json.
 * Supports external shell command execution with JSON input.
 */
export declare function loadStatusLineConfig(aicoreDir: string): StatusLineConfig | null;
/**
 * Execute the status line script and return rendered text.
 * Passes JSON input via stdin, captures stdout with 5s timeout.
 */
export declare function executeStatusLineScript(config: StatusLineConfig, input: Record<string, unknown>): string | null;
/**
 * Build status line JSON input for external script.
 */
export declare function buildStatusLineInput(status: StatusLine): Record<string, unknown>;
export declare function getStatusLine(projectRoot: string, model: string, contextPercent: number | null, totalCost?: number, contextWindow?: {
    tokens: number;
    usagePercent: number;
}): StatusLine;
export declare function formatStatusLine(status: StatusLine): string;
/** Stage symbol for display. */
export declare function stageSymbol(stage: string): string;
/**
 * Refresh the status line with debounce.
 * Call after every agent response to show updated context usage.
 *
 * Mirrors Claude Code: StatusLine.tsx uses React's useEffect + setInterval
 * for periodic refresh. We simulate with a debounced callback.
 */
export declare function scheduleStatusLineRefresh(renderFn: (text: string) => void, projectRoot: string, model: string, contextPercent: number | null): void;
/** Cancel any pending status line refresh. */
export declare function cancelStatusLineRefresh(): void;
//# sourceMappingURL=statusline.d.ts.map