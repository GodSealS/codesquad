/**
 * Terminal display utilities for the CodeSquad REPL.
 *
 * Uses chalk for ANSI color output. Handles banner rendering,
 * agent response streaming, error templates, and loading spinners.
 * Phase 1.1 — Step 1.1.4.
 */
export declare const ICON_ERROR: string;
export declare const ICON_WARN: string;
export declare const ICON_OK: string;
export declare const ICON_INFO: string;
/** Render the REPL startup banner. */
export declare function renderBanner(version: string): string;
/** Render the provider/model status line shown after the banner. */
export declare function renderProviderStatus(provider?: string, model?: string, ollamaDetected?: boolean): string;
/** Render the help text shown on `/help`. */
export declare function renderHelp(): string;
export declare function errorLine(msg: string): string;
export declare function warnLine(msg: string): string;
export declare function okLine(msg: string): string;
export declare function infoLine(msg: string): string;
/** Reset spinner state (for test cleanup). */
export declare function resetSpinnerState(): void;
/** Start a loading spinner on the current terminal line. */
export declare function startSpinner(message: string): void;
/** Stop the spinner and clear the line. */
export declare function stopSpinner(): void;
export declare function separator(): string;
/** Render inline token usage after an agent response. */
export declare function renderTokenUsage(inputTokens: number, outputTokens: number, availableTokens: number, costUsd?: number): string;
/**
 * Render response content with syntax-highlighted fenced code blocks.
 * Detects ``` fences and applies a distinct background style to code sections,
 * leaving plain text in the default color.
 */
export declare function renderFormattedContent(content: string): string;
//# sourceMappingURL=display.d.ts.map