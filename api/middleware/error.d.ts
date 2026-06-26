/**
 * Unified error handler for API routes.
 * Catches thrown errors and returns structured JSON responses.
 */
import type { Request, Response, NextFunction } from 'express';
export interface ApiError {
    error: string;
    code: number;
    details?: string;
}
export declare class AppError extends Error {
    statusCode: number;
    details?: string | undefined;
    constructor(message: string, statusCode?: number, details?: string | undefined);
}
export declare function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void;
//# sourceMappingURL=error.d.ts.map