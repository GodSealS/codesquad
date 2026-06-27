/**
 * Session import/export with automatic redaction.
 *
 * Exports sessions as Markdown files. Automatically redacts:
 *   1. System prompt messages (role: system)
 *   2. Sensitive tool call arguments
 *   3. Optional: API key patterns (--redact api-keys)
 *   4. Optional: Absolute paths (--redact paths)
 * Phase 1.2 — Step 1.2.4.
 */
import type { Session } from './session.js';
export interface ExportOptions {
    /** Remove all role:system messages. Default: true. */
    redactSystem?: boolean;
    /** Remove potential API key patterns from content. Default: false. */
    redactApiKeys?: boolean;
    /** Remove absolute file paths from content. Default: false. */
    redactPaths?: boolean;
}
export declare function exportSession(session: Session, options?: ExportOptions): Promise<string>;
/**
 * Parse a previously exported Markdown session back into a Session-like structure.
 * This is a best-effort reverse — message timestamps and structure are preserved.
 */
export declare function importSession(markdown: string, sessionName?: string): Promise<Partial<Session>>;
//# sourceMappingURL=import-export.d.ts.map