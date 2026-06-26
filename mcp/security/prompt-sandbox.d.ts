/**
 * Prompt Sandbox — User Content Boundary Wrapping
 *
 * Ensures that user-provided content (context, GDD, code) is cleanly separated
 * from agent prompt templates. Prevents:
 *   - Prompt injection ("ignore previous instructions...")
 *   - Context hijacking via malformed GDD content
 *   - Accidental instruction leakage
 *
 * Strategy:
 *   - Wrap user content in explicit XML boundary markers
 *   - Truncate oversized content with warning
 *   - Sanitize known injection patterns
 */
export interface SandboxedContext {
    /** Sanitized and wrapped GDD content */
    gdd?: string;
    /** Sanitized and wrapped code content */
    code?: string;
    /** Sanitized and wrapped reference list */
    references?: string;
    /** Sanitized and wrapped user input (task/arguments) */
    input?: string;
    /** Wrapped conversation history */
    history?: string;
    /** Warnings generated during sanitization */
    warnings: string[];
}
/**
 * Scan content for potential prompt injection patterns.
 * Returns detection results; does not block — only warns.
 *
 * @param content - User-provided content to scan
 * @param source  - Description of content source (for log)
 * @returns Array of matched pattern descriptions
 */
export declare function detectInjection(content: string, source: string): string[];
/**
 * Wrap content in a structured boundary tag.
 * This separates user content from agent prompt instructions,
 * making it harder for injected content to influence the LLM.
 *
 * @param content   - The raw user content
 * @param boundary  - The boundary tag definition (open/close)
 * @returns Wrapped content string
 */
export declare function wrapContent(content: string, boundary: {
    open: string;
    close: string;
}): string;
/**
 * Truncate oversized content with a warning.
 *
 * @param content   - The content to truncate
 * @param maxChars  - Maximum character limit
 * @param label     - Label for truncation warning
 * @returns Truncated content (or original if within limit) with warning prefix if truncated
 */
export declare function truncateContent(content: string, maxChars: number, label: string): string;
/**
 * Sandbox the complete set of user-provided context for an agent invocation.
 *
 * This is the main entry point. It:
 *   1. Scans for injection patterns
 *   2. Truncates oversized content
 *   3. Wraps all content in boundary markers
 *
 * @param context - The raw context from the caller
 * @returns Sanitized, wrapped context ready for prompt injection
 */
export declare function sandboxAgentContext(context: {
    gdd?: string;
    code?: string;
    references?: string[];
    input?: string;
    history?: string;
}): SandboxedContext;
/**
 * Lightweight sandbox for skill invocations (no tool calls, simpler context).
 */
export declare function sandboxSkillContext(args: {
    arguments?: string;
    gdd?: string;
    code?: string;
}): SandboxedContext;
//# sourceMappingURL=prompt-sandbox.d.ts.map