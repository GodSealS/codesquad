/**
 * Sessions API — list, detail, delete.
 * Shares session store with REPL via ~/.codesquad/sessions/.
 */
import type http from 'http';
interface WebServices {
    projectRoot: string;
}
export declare function handleSessions(req: http.IncomingMessage, res: http.ServerResponse, services: WebServices, path: string, method: string): Promise<void>;
export {};
//# sourceMappingURL=sessions.d.ts.map