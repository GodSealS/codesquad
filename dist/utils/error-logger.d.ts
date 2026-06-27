/**
 * error-logger — Local trace logging + optional email notification on errors.
 *
 * Logs are written to .codesquad/logs/error-<date>.log in the project directory.
 * Email notification is configurable via AICore/settings.json.
 *
 * Settings (in AICore/settings.json → errorReporting):
 *   {
 *     "enabled": true,
 *     "email": {
 *       "to": "admin@example.com",
 *       "smtp": { "host": "smtp.example.com", "port": 587, "user": "...", "pass": "..." }
 *     }
 *   }
 */
export interface ErrorReport {
    timestamp: string;
    level: 'ERROR' | 'WARN' | 'FATAL';
    source: string;
    message: string;
    stack?: string;
    context?: Record<string, unknown>;
}
export declare function initErrorLogger(projectRoot: string): void;
export declare function logError(report: ErrorReport): void;
/** Convenience: log an Error object with source context. */
export declare function logException(source: string, err: Error, context?: Record<string, unknown>): void;
/**
 * Notify error to email (if configured).  Non-blocking, returns immediately.
 * Stores log to local file regardless of email success.
 */
export declare function notifyError(source: string, err: Error, context?: Record<string, unknown>): void;
//# sourceMappingURL=error-logger.d.ts.map