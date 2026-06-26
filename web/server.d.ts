/**
 * CodeSquad Web Console — HTTP Server.
 *
 * Serves the Web Console SPA and REST API. Shares session store
 * with the REPL via ~/.codesquad/sessions/.
 *
 * Architecture:
 *   GET  /                → Static SPA (index.html)
 *   GET  /login?token=...  → Auth cookie
 *   GET  /api/*            → REST API (Bearer auth)
 *   POST /api/chat         → SSE streaming
 *   GET  /healthz          → Health check (no auth)
 */
import { createServer } from 'http';
export interface WebConsoleOptions {
    port: number;
    bind: string;
    authToken?: string;
    noAuth: boolean;
    readonly: boolean;
    open: boolean;
}
export declare function startWebServer(options: WebConsoleOptions): Promise<{
    server: ReturnType<typeof createServer>;
    token: string;
    port: number;
}>;
//# sourceMappingURL=server.d.ts.map