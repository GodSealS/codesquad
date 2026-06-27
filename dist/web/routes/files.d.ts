/**
 * Files API — project file tree and content reading.
 */
import type http from 'http';
export declare function handleFiles(req: http.IncomingMessage, res: http.ServerResponse, services: {
    projectRoot: string;
}, path: string, method: string): Promise<void>;
//# sourceMappingURL=files.d.ts.map