/**
 * Unified error handler for API routes.
 * Catches thrown errors and returns structured JSON responses.
 */
export class AppError extends Error {
    statusCode;
    details;
    constructor(message, statusCode = 500, details) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'AppError';
    }
}
export function errorHandler(err, _req, res, _next) {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            error: err.message,
            code: err.statusCode,
            details: err.details,
        });
        return;
    }
    // Unexpected errors
    console.error('[API] Unhandled error:', err.message);
    res.status(500).json({
        error: 'Internal server error',
        code: 500,
    });
}
//# sourceMappingURL=error.js.map