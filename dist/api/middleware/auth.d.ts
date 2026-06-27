/**
 * Optional Bearer token authentication middleware.
 * Disabled by default — enable by setting CODESQUAD_API_TOKEN env var.
 */
import type { Request, Response, NextFunction } from 'express';
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): void;
/** Check if auth is enabled. */
export declare function isAuthEnabled(): boolean;
//# sourceMappingURL=auth.d.ts.map